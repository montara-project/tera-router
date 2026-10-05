package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/legacyimport"
	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/password"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type legacyImportHandler struct {
	app *app.Application
}

// legacyImportResult reports what an import created and what it skipped.
type legacyImportResult struct {
	Source  legacyimport.Source    `json:"source"`
	Created map[string]int         `json:"created"`
	Skipped []legacyimport.Skipped `json:"skipped"`
}

func (r *legacyImportResult) skip(kind, name, reason string) {
	r.Skipped = append(r.Skipped, legacyimport.Skipped{Kind: kind, Name: name, Reason: reason})
}

// Import migrates a 9router or OmniRoute JSON backup (the request body) into
// Tera Router. Imports are additive: rows that already exist (same provider
// slug, API key, chain/alias name, proxy URL, account credential) are kept
// and the backup's copy is skipped, so re-running an import is safe.
func (h *legacyImportHandler) Import(c fiber.Ctx) error {
	src, ok := legacyimport.ParseSource(c.Params("source"))
	if !ok {
		return apperr.New(apperr.KindNotFound, "unknown import source %q", c.Params("source"))
	}
	backup, err := legacyimport.Decode(c.Body())
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	ctx := c.Context()
	actor := actorFrom(c)

	existing, err := h.app.Repos.Providers.List(ctx)
	if err != nil {
		return err
	}
	slugs := make(map[string]bool, len(existing))
	for _, p := range existing {
		slugs[p.Slug] = true
	}
	plan := legacyimport.BuildPlan(backup, src, func(slug string) bool { return slugs[slug] })

	res := legacyImportResult{
		Source:  src,
		Created: map[string]int{"custom_providers": 0, "proxy_pools": 0, "accounts": 0, "api_keys": 0, "chains": 0, "aliases": 0},
		Skipped: plan.Skipped,
	}
	if res.Skipped == nil {
		res.Skipped = []legacyimport.Skipped{}
	}

	if err := h.importProviders(ctx, plan.Providers, slugs, &res); err != nil {
		return err
	}
	pools, err := h.importProxyPools(ctx, plan.ProxyPools, &res)
	if err != nil {
		return err
	}
	if err := h.importAccounts(ctx, actor, src, plan.Accounts, pools, &res); err != nil {
		return err
	}
	if err := h.importKeys(ctx, plan.APIKeys, &res); err != nil {
		return err
	}
	if err := h.importChains(ctx, plan.Chains, &res); err != nil {
		return err
	}
	if err := h.importAliases(ctx, plan.Aliases, &res); err != nil {
		return err
	}

	auditRecord(ctx, h.app, actor, "import."+string(src), string(src), map[string]any{"created": res.Created, "skipped": len(res.Skipped)})
	return dtos.Item(c, fiber.StatusOK, res, "Import complete")
}

func (h *legacyImportHandler) importProviders(ctx context.Context, providers []legacyimport.PlannedProvider, slugs map[string]bool, res *legacyImportResult) error {
	for _, p := range providers {
		if slugs[p.Slug] {
			res.skip("custom_provider", p.Slug, "a provider with this slug already exists; kept the existing one")
			continue
		}
		row := models.CustomProvider{
			ID:       uuid.NewString(),
			Name:     p.Name,
			Slug:     p.Slug,
			BaseURL:  p.BaseURL,
			APIKind:  p.APIKind,
			Pricing:  "{}",
			Metadata: `{"imported_from":"` + string(res.Source) + `"}`,
			Enabled:  true,
			Priority: 100,
		}
		if err := h.app.Repos.Providers.Insert(ctx, row); err != nil {
			return err
		}
		slugs[p.Slug] = true
		res.Created["custom_providers"]++
	}
	return nil
}

// importProxyPools creates pools and returns source pool id → Tera pool id.
// A pool whose URL already exists is reused rather than duplicated.
func (h *legacyImportHandler) importProxyPools(ctx context.Context, pools []legacyimport.PlannedPool, res *legacyImportResult) (map[string]string, error) {
	ids := map[string]string{}
	existing, err := h.app.Repos.ProxyPools.List(ctx)
	if err != nil {
		return nil, err
	}
	byURL := make(map[string]string, len(existing))
	for _, p := range existing {
		byURL[p.URL] = p.ID
	}
	for _, p := range pools {
		if id, ok := byURL[p.URL]; ok {
			ids[p.SourceID] = id
			res.skip("proxy_pool", p.Name, "a pool with this proxy URL already exists; accounts were linked to it")
			continue
		}
		status := "active"
		if !p.Active {
			status = "inactive"
		}
		row := models.ProxyPool{ID: uuid.NewString(), Name: p.Name, URL: p.URL, Mode: p.Mode, Label: "Imported from " + string(res.Source), Status: status}
		if err := h.app.Repos.ProxyPools.Insert(ctx, row); err != nil {
			return nil, err
		}
		ids[p.SourceID] = row.ID
		byURL[p.URL] = row.ID
		res.Created["proxy_pools"]++
	}
	return ids, nil
}

func (h *legacyImportHandler) importAccounts(ctx context.Context, actor string, src legacyimport.Source, accounts []legacyimport.PlannedAccount, pools map[string]string, res *legacyImportResult) error {
	oauthDedup := &oauthHandler{app: h.app}
	for _, pa := range accounts {
		if _, err := ensureCustomProviderRow(ctx, h.app, actor, pa.Provider); err != nil {
			return err
		}
		raw, err := json.Marshal(pa.Metadata)
		if err != nil {
			return err
		}
		acc := models.Account{
			ID:             uuid.NewString(),
			Provider:       pa.Provider,
			Label:          pa.Label,
			AuthKind:       models.AuthAPIKey,
			Priority:       pa.Priority,
			Disabled:       pa.Disabled,
			NeedsReconnect: pa.NeedsReconnect,
			Metadata:       string(raw),
			TokenExpiresAt: pa.ExpiresAt,
		}
		if pa.OAuth {
			acc.AuthKind = models.AuthOAuth
		}
		if id, ok := pools[pa.ProxyPoolRef]; ok && pa.ProxyPoolRef != "" {
			acc.ProxyPoolID = &id
		}
		in := accountInput{APIKey: pa.APIKey, Token: pa.AccessToken, Refresh: pa.RefreshToken}
		if err := sealCredential(h.app, &acc, in); err != nil {
			return err
		}

		dup, err := h.duplicateAccount(ctx, oauthDedup, acc, pa)
		if err != nil {
			return err
		}
		if dup {
			res.skip("account", pa.Label, "an account with this credential already exists")
			continue
		}
		if err := h.app.Repos.Accounts.Insert(ctx, acc); err != nil {
			return err
		}
		res.Created["accounts"]++
	}
	if src == legacyimport.OmniRoute && res.Created["accounts"] > 0 {
		res.skip("account", "credentials", "OmniRoute redacts credentials: imported accounts are disabled until you reconnect them")
	}
	return nil
}

// duplicateAccount reports whether the account already exists: same API key
// hash, same OAuth grant (email / refresh token), or — for credential-less
// stubs — same provider and label.
func (h *legacyImportHandler) duplicateAccount(ctx context.Context, oauthDedup *oauthHandler, acc models.Account, pa legacyimport.PlannedAccount) (bool, error) {
	switch {
	case acc.KeyHash != "":
		_, err := h.app.Repos.Accounts.GetByKeyHash(ctx, acc.KeyHash)
		if err == nil {
			return true, nil
		}
		if !errors.Is(err, apperr.ErrNotFound) {
			return false, err
		}
		return false, nil
	case pa.AccessToken != "" || pa.RefreshToken != "":
		existing, err := oauthDedup.findExistingOAuthAccount(ctx, acc.Provider, pa.Metadata, pa.RefreshToken)
		return existing != nil, err
	default:
		list, err := h.app.Repos.Accounts.ListByProvider(ctx, acc.Provider)
		if err != nil {
			return false, err
		}
		for _, a := range list {
			if a.Label == acc.Label {
				return true, nil
			}
		}
		return false, nil
	}
}

// importKeys re-hashes each key string, so a client still configured with
// the old router's key authenticates against Tera Router unchanged.
func (h *legacyImportHandler) importKeys(ctx context.Context, keys []legacyimport.PlannedKey, res *legacyImportResult) error {
	for _, k := range keys {
		lookup := apikey.LookupHash(k.Key)
		if _, err := h.app.Repos.APIKeys.GetByLookup(ctx, lookup); err == nil {
			res.skip("api_key", k.Name, "this key already exists")
			continue
		} else if !errors.Is(err, apperr.ErrNotFound) {
			return err
		}
		hash, err := password.Hash(k.Key)
		if err != nil {
			return err
		}
		sealed, err := h.app.Secrets.SealString(k.Key)
		if err != nil {
			return err
		}
		key := models.APIKey{
			ID:         uuid.NewString(),
			Name:       k.Name,
			KeyHash:    hash,
			LookupHash: lookup,
			Display:    fingerprint(k.Key),
			Disabled:   k.Disabled,
			Secret:     sealed,
		}
		if err := h.app.Repos.APIKeys.Insert(ctx, key); err != nil {
			return err
		}
		res.Created["api_keys"]++
	}
	return nil
}

func (h *legacyImportHandler) importChains(ctx context.Context, chains []legacyimport.PlannedChain, res *legacyImportResult) error {
	for _, pc := range chains {
		if _, err := h.app.Repos.Chains.GetByName(ctx, pc.Name); err == nil {
			res.skip("chain", pc.Name, "a chain with this name already exists")
			continue
		} else if !errors.Is(err, apperr.ErrNotFound) {
			return err
		}
		now := time.Now()
		chain := models.Chain{ID: uuid.NewString(), Name: pc.Name, Strategy: "priority", Enabled: true}
		for i, s := range pc.Steps {
			chain.Steps = append(chain.Steps, models.ChainStep{
				ID: uuid.NewString(), ChainID: chain.ID, Position: i + 1,
				Provider: s.Provider, Model: s.Model, CreatedAt: now,
			})
		}
		if err := h.app.Repos.Chains.Insert(ctx, chain); err != nil {
			return err
		}
		res.Created["chains"]++
	}
	return nil
}

func (h *legacyImportHandler) importAliases(ctx context.Context, aliases []legacyimport.PlannedAlias, res *legacyImportResult) error {
	for _, pa := range aliases {
		name := strings.TrimSpace(pa.Name)
		if _, err := h.app.Repos.Aliases.GetByName(ctx, name); err == nil {
			res.skip("alias", name, "an alias with this name already exists")
			continue
		} else if !errors.Is(err, apperr.ErrNotFound) {
			return err
		}
		alias := models.ModelAlias{ID: uuid.NewString(), Name: name, Active: true}
		for i, t := range pa.Targets {
			alias.Targets = append(alias.Targets, models.AliasTarget{
				ID: uuid.NewString(), Position: i + 1, Provider: t.Provider, Model: t.Model, Active: true,
			})
		}
		if err := h.app.Repos.Aliases.Upsert(ctx, alias); err != nil {
			return err
		}
		res.Created["aliases"]++
	}
	return nil
}
