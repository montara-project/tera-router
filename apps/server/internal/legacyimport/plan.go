package legacyimport

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"tera-router/server/internal/catalog"
	"tera-router/server/internal/lib"
)

// Plan is the translated import, ready for the handler to seal and persist.
type Plan struct {
	Providers  []PlannedProvider
	ProxyPools []PlannedPool
	Accounts   []PlannedAccount
	APIKeys    []PlannedKey
	Chains     []PlannedChain
	Aliases    []PlannedAlias
	Skipped    []Skipped
}

// PlannedProvider is a custom provider the import creates (unless its slug
// already exists, in which case the existing row is kept).
type PlannedProvider struct {
	Slug    string
	Name    string
	BaseURL string
	APIKind string
}

// PlannedPool is a proxy pool; SourceID links accounts that used it.
type PlannedPool struct {
	SourceID string
	Name     string
	URL      string
	Mode     string
	Active   bool
}

// PlannedAccount is one upstream credential. Secrets are plaintext here and
// sealed by the handler.
type PlannedAccount struct {
	Provider       string
	Label          string
	OAuth          bool
	Priority       int
	Disabled       bool
	NeedsReconnect bool
	APIKey         string
	AccessToken    string
	RefreshToken   string
	ExpiresAt      *time.Time
	Metadata       map[string]string
	ProxyPoolRef   string
}

// PlannedKey is an inbound API key imported with its original key string, so
// clients configured against the old router keep working.
type PlannedKey struct {
	Name     string
	Key      string
	Disabled bool
}

// Target is one provider/model pair of a chain step or alias target.
type Target struct {
	Provider string
	Model    string
}

// PlannedChain is a chain built from a combo.
type PlannedChain struct {
	Name  string
	Steps []Target
}

// PlannedAlias is a model alias pool.
type PlannedAlias struct {
	Name    string
	Targets []Target
}

// Skipped records a source row that was not imported, and why.
type Skipped struct {
	Kind   string `json:"kind"`
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

func (p *Plan) skip(kind, name, reason string) {
	p.Skipped = append(p.Skipped, Skipped{Kind: kind, Name: name, Reason: reason})
}

func (p *Plan) addProvider(t target) {
	if !t.custom || p.hasProvider(t.slug) {
		return
	}
	p.Providers = append(p.Providers, PlannedProvider{Slug: t.slug, Name: t.name, BaseURL: t.baseURL, APIKind: t.apiKind})
}

func (p *Plan) hasProvider(slug string) bool {
	return slices.ContainsFunc(p.Providers, func(pp PlannedProvider) bool { return pp.Slug == slug })
}

// BuildPlan maps a decoded backup onto Tera Router rows. providerExists
// reports whether a custom provider slug already exists, so chain steps and
// alias targets may point at it even when the backup creates no account for
// it.
func BuildPlan(b *Backup, src Source, providerExists func(slug string) bool) Plan {
	var p Plan
	redacted := src == OmniRoute

	// refs resolves the provider part of "ref/model" strings: node ids and
	// node prefixes first, then known provider ids/aliases.
	nodes := map[string]target{}
	refs := map[string]target{}
	for _, n := range b.Nodes {
		t := nodeTarget(n, lib.Slugify)
		if t.slug == "" || t.baseURL == "" {
			p.skip("provider_node", firstNonEmpty(n.Name, n.ID), "the node has no name or base URL")
			continue
		}
		nodes[n.ID] = t
		refs[n.ID] = t
		if n.Prefix != "" {
			refs[n.Prefix] = t
		}
		p.addProvider(t)
	}

	for _, pool := range b.ProxyPools {
		name := firstNonEmpty(pool.Name, pool.ProxyURL, pool.ID)
		if strings.TrimSpace(pool.ProxyURL) == "" {
			p.skip("proxy_pool", name, "the pool has no proxy URL")
			continue
		}
		mode := strings.TrimSpace(pool.Type)
		if pool.StrictProxy {
			mode = strings.TrimSpace(mode + " strict")
		}
		p.ProxyPools = append(p.ProxyPools, PlannedPool{
			SourceID: pool.ID,
			Name:     name,
			URL:      strings.TrimSpace(pool.ProxyURL),
			Mode:     mode,
			Active:   pool.IsActive == nil || *pool.IsActive,
		})
	}

	for _, c := range b.Connections {
		label := firstNonEmpty(c.Name, c.DisplayName, c.Email, c.Provider)
		t, ok := nodes[c.Provider]
		if !ok {
			t, ok = knownTarget(c.Provider)
		}
		if !ok {
			if base := asString(c.ProviderSpecificData["baseUrl"]); base != "" && lib.Slugify(c.Provider) != "" {
				t = target{slug: lib.Slugify(c.Provider), custom: true, name: c.Provider, baseURL: normalizeBaseURL(base, "openai"), apiKind: "openai"}
				ok = true
			}
		}
		if !ok {
			p.skip("account", label, fmt.Sprintf("provider %q has no Tera Router equivalent", c.Provider))
			continue
		}

		acc := PlannedAccount{
			Provider:     t.slug,
			Label:        label,
			OAuth:        t.oauth,
			Priority:     c.Priority,
			Disabled:     c.IsActive != nil && !*c.IsActive,
			Metadata:     metadataFor(c, t, src),
			ProxyPoolRef: proxyPoolRef(c.ProviderSpecificData),
		}
		if acc.Priority <= 0 {
			acc.Priority = 100
		}
		switch {
		case redacted:
			// OmniRoute redacts credentials: keep the account as a disabled
			// stub the operator re-authenticates.
			acc.Disabled = true
			acc.NeedsReconnect = true
		case t.oauth:
			if c.AccessToken == "" && c.RefreshToken == "" {
				p.skip("account", label, "the OAuth account has no token in the backup")
				continue
			}
			acc.AccessToken, acc.RefreshToken, acc.ExpiresAt = c.AccessToken, c.RefreshToken, c.ExpiresAt
		default:
			if strings.TrimSpace(c.APIKey) == "" {
				p.skip("account", label, fmt.Sprintf("provider %q needs an API key and the backup has none (OAuth/subscription logins do not transfer)", c.Provider))
				continue
			}
			acc.APIKey = strings.TrimSpace(c.APIKey)
		}
		p.addProvider(t)
		p.Accounts = append(p.Accounts, acc)
	}

	for _, k := range b.APIKeys {
		name := firstNonEmpty(k.Name, "Imported key")
		if redacted {
			p.skip("api_key", name, "OmniRoute exports do not carry usable API keys; re-create it")
			continue
		}
		if strings.TrimSpace(k.Key) == "" {
			p.skip("api_key", name, "the key string is missing")
			continue
		}
		p.APIKeys = append(p.APIKeys, PlannedKey{Name: name, Key: strings.TrimSpace(k.Key), Disabled: k.IsActive != nil && !*k.IsActive})
	}

	resolve := func(ref string) (string, bool) {
		if t, ok := refs[ref]; ok {
			return t.slug, true
		}
		t, ok := knownTarget(ref)
		if !ok {
			return "", false
		}
		if !t.custom || p.hasProvider(t.slug) || providerExists(t.slug) {
			return t.slug, true
		}
		return "", false
	}
	targets := func(owner string, refsIn []any) []Target {
		var out []Target
		for _, m := range refsIn {
			ref, model := stepRef(m)
			if ref == "" || model == "" {
				p.skip("step", owner, fmt.Sprintf("%v is not a provider/model reference", m))
				continue
			}
			slug, ok := resolve(ref)
			if !ok {
				p.skip("step", owner+" → "+ref+"/"+model, fmt.Sprintf("provider %q is not available in Tera Router", ref))
				continue
			}
			out = append(out, Target{Provider: slug, Model: model})
		}
		return out
	}

	for _, cb := range b.Combos {
		name := strings.TrimSpace(cb.Name)
		if name == "" {
			continue
		}
		steps := targets(name, cb.Models)
		if len(steps) == 0 {
			p.skip("chain", name, "no step maps to a Tera Router provider")
			continue
		}
		p.Chains = append(p.Chains, PlannedChain{Name: name, Steps: steps})
	}

	names := make([]string, 0, len(b.ModelAliases))
	for name := range b.ModelAliases {
		names = append(names, name)
	}
	slices.Sort(names)
	for _, name := range names {
		var values []any
		switch v := b.ModelAliases[name].(type) {
		case []any:
			values = v
		default:
			values = []any{v}
		}
		ts := targets(name, values)
		if len(ts) == 0 {
			p.skip("alias", name, "no target maps to a Tera Router provider")
			continue
		}
		p.Aliases = append(p.Aliases, PlannedAlias{Name: name, Targets: ts})
	}

	return p
}

// stepRef splits a combo step / alias target into its provider reference and
// model id. Strings are "ref/model"; objects carry model plus an optional
// provider/providerId. Combo-to-combo references are not provider targets.
func stepRef(v any) (ref, model string) {
	switch t := v.(type) {
	case string:
		ref, model, _ = strings.Cut(strings.TrimSpace(t), "/")
		return ref, model
	case map[string]any:
		if asString(t["kind"]) == "combo-ref" {
			return "", ""
		}
		model = asString(t["model"])
		if prov := firstNonEmpty(asString(t["providerId"]), asString(t["provider"])); prov != "" {
			return prov, strings.TrimPrefix(model, prov+"/")
		}
		ref, model, _ = strings.Cut(model, "/")
		return ref, model
	}
	return "", ""
}

// proxyPoolRef reads the connection's proxy pool link ("__none__" = none).
func proxyPoolRef(psd map[string]any) string {
	id := asString(psd["proxyPoolId"])
	if id == "__none__" {
		return ""
	}
	return id
}

// metadataFor builds the account metadata Tera Router reads: the upstream
// base URL for catalog OAuth providers and Cloudflare's account-scoped
// endpoint, the ChatGPT workspace for Codex, and the login email.
func metadataFor(c Connection, t target, src Source) map[string]string {
	meta := map[string]string{"imported_from": string(src)}
	if c.Email != "" {
		meta["email"] = c.Email
	}
	psd := c.ProviderSpecificData
	spec, inCatalog := catalog.Lookup(t.slug)
	if t.oauth && inCatalog && spec.BaseURL != "" {
		meta["base_url"] = spec.BaseURL
	}
	switch t.slug {
	case "codex":
		if id := firstNonEmpty(asString(psd["chatgptAccountId"]), asString(psd["accountId"])); id != "" {
			meta["chatgpt_account_id"] = id
		}
		if plan := firstNonEmpty(asString(psd["chatgptPlanType"]), asString(psd["planType"])); plan != "" {
			meta["chatgpt_plan_type"] = plan
		}
	case "cloudflare":
		if id := firstNonEmpty(asString(psd["accountId"]), asString(psd["account_id"])); id != "" && inCatalog {
			meta["base_url"] = strings.ReplaceAll(spec.BaseURL, "{account_id}", id)
		}
	}
	return meta
}
