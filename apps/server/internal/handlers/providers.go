package handlers

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/catalog"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/modelcatalog"
	"tera-router/server/internal/models"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type providersHandler struct {
	app *app.Application
}

// The custom-<kind>- slug marker (e.g. "custom-openai-vllm") is a naming
// convention owned by callers: the web UI composes it, API clients may omit
// it entirely. The server stores the slug verbatim (normalized by slugify)
// and never parses it — the gateway resolves providers by exact lookup.

// slugify folds a display name into a slug segment: lowercase, non-alnum runs
// become single dashes.
func slugify(s string) string {
	var b strings.Builder
	dash := true
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
			dash = false
		} else if !dash {
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.TrimSuffix(b.String(), "-")
}

// customProviderFrom converts a CustomProvider DTO into the stored model.
func customProviderFrom(d dtos.CustomProvider) models.CustomProvider {
	p := models.CustomProvider{
		Name:     d.Name,
		Slug:     slugify(cmp.Or(d.Slug, d.Name)),
		BaseURL:  d.BaseURL,
		APIKind:  cmp.Or(d.APIKind, "openai"),
		Pricing:  encodeJSON(d.Pricing),
		Metadata: encodeJSON(d.Metadata),
		Enabled:  true,
	}
	if d.Enabled != nil {
		p.Enabled = *d.Enabled
	}
	if d.Priority != nil {
		p.Priority = *d.Priority
	}
	return p
}

// applyCustomProviderPatch overlays the fields the request actually supplied
// onto the stored provider. Rebuilding the row would blank pricing/metadata to
// "{}", re-enable a disabled provider and reset its priority.
func applyCustomProviderPatch(p *models.CustomProvider, d dtos.CustomProvider) {
	if d.Name != "" {
		p.Name = d.Name
	}
	if d.APIKind != "" {
		p.APIKind = d.APIKind
	}
	// Slug is immutable: accounts and chain steps reference the provider by
	// slug, so renaming it here would orphan them.
	if d.BaseURL != "" {
		p.BaseURL = d.BaseURL
	}
	if d.Pricing != nil {
		p.Pricing = encodeJSON(d.Pricing)
	}
	if d.Metadata != nil {
		p.Metadata = encodeJSON(d.Metadata)
	}
	if d.Priority != nil {
		p.Priority = *d.Priority
	}
	if d.Enabled != nil {
		p.Enabled = *d.Enabled
	}
}

func encodeJSON(v any) string {
	if v == nil {
		return "{}"
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

// Index returns the {connected, available} overview for the providers page:
// catalog providers with live account counts plus custom providers.
func (h *providersHandler) Index(c fiber.Ctx) error {
	counts, err := h.app.Repos.Accounts.CountByProvider(c.Context())
	if err != nil {
		return err
	}
	customs, err := h.app.Repos.Providers.List(c.Context())
	if err != nil {
		return err
	}
	customSlugs := map[string]bool{}
	for _, c := range customs {
		customSlugs[c.Slug] = true
	}

	overview := dtos.ProviderOverview{
		Connected: []dtos.ProviderView{},
		Available: []dtos.ProviderView{},
	}

	for _, spec := range catalog.Listed() {
		view := dtos.ProviderView{
			ID:           "prov-" + spec.Slug,
			Name:         spec.Name,
			Slug:         spec.Slug,
			Connected:    counts[spec.Slug] > 0 || customSlugs[spec.Slug],
			Accounts:     counts[spec.Slug],
			Capabilities: spec.Capabilities,
			Official:     spec.Official,
			Notice:       spec.Notice,
			APIKind:      spec.Dialect,
		}
		if view.Connected {
			overview.Connected = append(overview.Connected, view)
			continue
		}
		overview.Available = append(overview.Available, view)
	}

	// Custom providers with a slug outside the catalog render as their own
	// connected entries; catalog slugs are already covered above.
	for _, c := range customs {
		if _, ok := catalog.Lookup(c.Slug); ok {
			continue
		}
		overview.Connected = append(overview.Connected, dtos.ProviderView{
			ID:           c.ID,
			Name:         c.Name,
			Slug:         c.Slug,
			Connected:    true,
			Accounts:     counts[c.Slug],
			Capabilities: []string{"chat"},
			Official:     true,
			APIKind:      c.APIKind,
		})
	}
	return dtos.OK(c, overview)
}

// Rates returns the pricing snapshot (overrides + catalog fallbacks).
func (h *providersHandler) Rates(c fiber.Ctx) error {
	overrides, err := h.app.Repos.Pricing.List(c.Context(), "")
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"overrides": overrides})
}

func (h *providersHandler) CustomIndex(c fiber.Ctx) error {
	providers, err := h.app.Repos.Providers.List(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, providers, dtos.TotalMeta(len(providers)))
}

func (h *providersHandler) CustomStore(c fiber.Ctx) error {
	var req dtos.CustomProvider
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	provider := customProviderFrom(req)
	provider.ID = uuid.NewString()
	if err := h.app.Repos.Providers.Insert(c.Context(), provider); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "custom_provider.create", provider.ID, map[string]string{"slug": provider.Slug})
	return dtos.Created(c, provider, "Provider created")
}

func (h *providersHandler) CustomUpdate(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.CustomProvider
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	provider, err := h.app.Repos.Providers.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	applyCustomProviderPatch(&provider, req)
	if err := h.app.Repos.Providers.Update(c.Context(), provider); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "custom_provider.update", provider.ID, nil)

	updated, err := h.app.Repos.Providers.Get(c.Context(), provider.ID)
	if err != nil {
		return err
	}
	return dtos.OK(c, updated)
}

// CustomDelete removes a custom provider and everything scoped to it: its
// accounts (API keys), stored model catalog, and per-model pricing and
// capability overrides. Usage history is kept.
func (h *providersHandler) CustomDelete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	result, err := h.app.Repos.Providers.Delete(c.Context(), id.String())
	if err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "custom_provider.delete", id.String(),
		map[string]any{"slug": result.Slug, "accounts_deleted": result.Accounts})

	message := "Provider deleted"
	if result.Accounts > 0 {
		message = fmt.Sprintf("Provider deleted with %d %s", result.Accounts,
			pluralize(result.Accounts, "API key", "API keys"))
	}
	return dtos.Deleted(c, message)
}

// pluralize picks the singular or plural form for n.
func pluralize(n int64, singular, plural string) string {
	if n == 1 {
		return singular
	}
	return plural
}

// CustomModels returns the provider's stored model catalog with each model's
// active/disabled state (GET /v1/custom-providers/:id/models). The catalog is
// what the gateway uses to resolve bare model ids and to advertise them on
// /v1/models.
//
// Query params: search (case-insensitive substring on the model id), state
// (active/disabled — pickers pass active to get only routable models), and
// offset/limit (limit defaults to 10, capped at 100) for the dashboard's
// paged catalog view. The response always reports totals over the whole
// catalog so a single page is enough to render the header and pagination.
func (h *providersHandler) CustomModels(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	provider, err := h.app.Repos.Providers.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	cat, err := modelcatalog.Load(c.Context(), h.app.Repos.Settings, provider.Slug)
	if errors.Is(err, modelcatalog.ErrNoCatalog) {
		return dtos.OK(c, fiber.Map{"models": []modelcatalog.ModelEntry{}, "fetched_at": nil})
	}
	if err != nil {
		return err
	}

	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	page, total, enabled := catalogPage(cat.Models, c.Query("search"), c.Query("state"), offset, limit)
	return dtos.OK(c, fiber.Map{
		"models":     page,
		"total":      total,
		"enabled":    enabled,
		"count":      len(cat.Models),
		"fetched_at": cat.FetchedAt,
	})
}

// catalogPage filters one catalog by a case-insensitive id substring and an
// optional state ("active"/"disabled"; any other value keeps both), then
// slices out one page — state and search narrow the catalog BEFORE paging, so
// pickers that only need routable models see them even when the full catalog
// spans many pages. It returns the page, the filtered total (for page count),
// and the enabled count over the whole catalog (for the header).
func catalogPage(models []modelcatalog.ModelEntry, search, state string, offset, limit int) (page []modelcatalog.ModelEntry, total, enabled int) {
	if models == nil {
		models = []modelcatalog.ModelEntry{}
	}
	for _, m := range models {
		if m.State == modelcatalog.StateActive {
			enabled++
		}
	}

	filtered := models
	if state == modelcatalog.StateActive || state == modelcatalog.StateDisabled {
		narrowed := make([]modelcatalog.ModelEntry, 0, len(models))
		for _, m := range models {
			if m.State == state {
				narrowed = append(narrowed, m)
			}
		}
		filtered = narrowed
	}
	if q := strings.ToLower(strings.TrimSpace(search)); q != "" {
		narrowed := make([]modelcatalog.ModelEntry, 0, len(filtered))
		for _, m := range filtered {
			if strings.Contains(strings.ToLower(m.ID), q) {
				narrowed = append(narrowed, m)
			}
		}
		filtered = narrowed
	}
	total = len(filtered)

	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	if offset > total {
		offset = total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return filtered[offset:end], total, enabled
}

// CustomModelsSync fetches the model catalog straight from the provider's
// upstream model-list endpoint, authenticated with its highest-priority
// usable credential (POST /v1/custom-providers/:id/models/sync), and merges
// it into the stored catalog. Disabled models stay disabled across syncs.
// Models whose upstream advertises pricing get a pricing override created —
// that is what keeps the usage page from showing "Unpriced" for them.
func (h *providersHandler) CustomModelsSync(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	provider, err := h.app.Repos.Providers.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	if provider.BaseURL == "" {
		return apperr.New(apperr.KindUnprocessable, "provider has no base_url configured")
	}

	accounts, err := h.app.Repos.Accounts.ListUsable(c.Context(), provider.Slug)
	if err != nil {
		return err
	}
	apiKey := ""
	for _, account := range accounts {
		// Mirror the account probe: OAuth credentials live in Token,
		// API keys in Secret.
		if !account.Secret.Empty() {
			apiKey, err = h.app.Secrets.OpenString(fromModelsSealed(account.Secret))
		} else if !account.Token.Empty() {
			apiKey, err = h.app.Secrets.OpenString(fromModelsSealed(account.Token))
		}
		if apiKey != "" || err != nil {
			break
		}
	}
	if err != nil {
		return err
	}
	if apiKey == "" {
		return apperr.New(apperr.KindUnprocessable, "no usable credential for this provider; add an API key first")
	}

	// Match the gateway's dialect resolution (customProviderDialect): the
	// operator-set api_kind may carry the "custom-" marker, whitespace, or
	// different casing the raw comparison would miss.
	kind := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(provider.APIKind)), "custom-")
	anthropic := kind == "anthropic"
	endpoint := upstreamModelsEndpoint(provider.BaseURL, anthropic)
	upstream, err := h.app.Services.Upstream.ListModels(c.Context(), endpoint, anthropic, apiKey)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}

	ids := make([]string, 0, len(upstream))
	for _, m := range upstream {
		ids = append(ids, m.ID)
	}
	cat, err := modelcatalog.Store(c.Context(), h.app.Repos.Settings, provider.Slug, ids)
	if err != nil {
		return err
	}

	priced, err := h.importUpstreamPricing(c.Context(), provider.Slug, upstream)
	if err != nil {
		return err
	}
	if priced > 0 {
		auditRecord(c.Context(), h.app, actorFrom(c), "pricing.import_upstream", provider.Slug, map[string]string{"count": strconv.Itoa(priced)})
	}
	return dtos.OK(c, fiber.Map{"models": cat.Models, "fetched_at": cat.FetchedAt, "priced": priced})
}

// importUpstreamPricing creates pricing overrides for synced models whose
// upstream advertises rates. Existing overrides are never touched — the
// operator's price (or an earlier sync's) wins; delete the override in the
// dashboard to re-import from the upstream. Returns how many were created.
func (h *providersHandler) importUpstreamPricing(ctx context.Context, providerSlug string, upstream []services.UpstreamModel) (int, error) {
	existing, err := h.app.Repos.Pricing.List(ctx, providerSlug)
	if err != nil {
		return 0, err
	}
	have := make(map[string]bool, len(existing))
	for _, o := range existing {
		have[o.Model] = true
	}

	imported := 0
	for _, m := range upstream {
		if m.Pricing == nil || have[m.ID] {
			continue
		}
		override := models.PricingOverride{
			ID:               uuid.NewString(),
			Provider:         providerSlug,
			Model:            m.ID,
			InputMicros:      m.Pricing.InputMicros,
			OutputMicros:     m.Pricing.OutputMicros,
			CacheReadMicros:  m.Pricing.CacheReadMicros,
			CacheWriteMicros: m.Pricing.CacheWriteMicros,
		}
		if err := h.app.Repos.Pricing.Upsert(ctx, override); err != nil {
			return imported, err
		}
		have[m.ID] = true
		imported++
	}
	return imported, nil
}

// usableAPIKey opens the highest-priority usable credential of a provider:
// API keys live in Secret, OAuth tokens in Token. Returns "" when none of the
// provider's usable accounts yields a readable secret.
// usableBaseURL returns the first usable account's metadata.base_url
// override for a catalog provider. Providers whose endpoint embeds an
// account-scoped segment (e.g. Cloudflare's /accounts/<id>/ai) keep only a
// template in the catalog; the real URL lives on the account.
func (h *providersHandler) usableBaseURL(ctx context.Context, providerSlug string) string {
	accounts, err := h.app.Repos.Accounts.ListUsable(ctx, providerSlug)
	if err != nil {
		return ""
	}
	for _, account := range accounts {
		var meta map[string]any
		if json.Unmarshal([]byte(orEmptyJSON(account.Metadata)), &meta) != nil {
			continue
		}
		if u, ok := meta["base_url"].(string); ok && u != "" {
			return u
		}
	}
	return ""
}

func (h *providersHandler) usableAPIKey(ctx context.Context, providerSlug string) string {
	accounts, err := h.app.Repos.Accounts.ListUsable(ctx, providerSlug)
	if err != nil {
		return ""
	}
	for _, account := range accounts {
		if !account.Secret.Empty() {
			if key, err := h.app.Secrets.OpenString(fromModelsSealed(account.Secret)); err == nil && key != "" {
				return key
			}
		}
		if !account.Token.Empty() {
			if key, err := h.app.Secrets.OpenString(fromModelsSealed(account.Token)); err == nil && key != "" {
				return key
			}
		}
	}
	return ""
}

// modelsSyncProviders are the catalog providers whose model list the dashboard
// can sync (POST /v1/providers/:id/models/sync), each with its own source
// ported from IDRouter's connectors: OpenRouter's public /models (whose
// pricing is imported into the overrides), the Ollama family's /api/tags,
// Cline's union of /models and the recommended-models free list, and the
// OpenAI/Anthropic official /v1/models.
var modelsSyncProviders = map[string]bool{
	"openrouter":   true,
	"ollama":       true,
	"ollama-local": true,
	"cline":        true,
	"cloudflare":   true,
	"openai":       true,
	"anthropic":    true,
}

// ModelsSync refreshes the stored model catalog of a catalog provider. The
// per-provider source decides whether a credential is needed: Cline requires
// an account key, OpenRouter's list is public (a stored key is still sent for
// rate limiting), and Ollama accepts a key only on the cloud tier.
func (h *providersHandler) ModelsSync(c fiber.Ctx) error {
	slug := c.Params("id")
	if !modelsSyncProviders[slug] {
		if _, ok := catalog.Lookup(slug); ok {
			return apperr.New(apperr.KindUnprocessable, "provider %s does not support model sync", slug)
		}
		return apperr.ErrNotFound
	}
	spec, _ := catalog.Lookup(slug)

	apiKey := h.usableAPIKey(c.Context(), slug)

	var (
		upstream []services.UpstreamModel
		err      error
	)
	switch slug {
	case "openrouter":
		upstream, err = h.app.Services.Upstream.ListModels(c.Context(), spec.BaseURL+"/models", false, apiKey)
	case "ollama", "ollama-local":
		upstream, err = h.app.Services.Upstream.ListOllamaModels(c.Context(), spec.BaseURL, apiKey)
	case "cline":
		if apiKey == "" {
			return apperr.New(apperr.KindUnprocessable, "no usable credential for this provider; add an API key first")
		}
		upstream, err = h.app.Services.Upstream.ListClineModels(c.Context(), spec.BaseURL, apiKey)
	case "cloudflare":
		if apiKey == "" {
			return apperr.New(apperr.KindUnprocessable, "no usable credential for this provider; add an API key first")
		}
		// The catalog URL embeds {account_id}; the stored account's base_url
		// override carries the real endpoint.
		base := spec.BaseURL
		if u := h.usableBaseURL(c.Context(), slug); u != "" {
			base = strings.TrimSuffix(u, "/")
		}
		upstream, err = h.app.Services.Upstream.ListModels(c.Context(), base+"/models", false, apiKey)
	case "openai", "anthropic":
		if apiKey == "" {
			return apperr.New(apperr.KindUnprocessable, "no usable credential for this provider; add an API key first")
		}
		// The official /v1/models of each; anthropicDialect only swaps the
		// auth headers (x-api-key + anthropic-version) — the response envelope
		// is the same {"data":[{id}]} shape.
		upstream, err = h.app.Services.Upstream.ListModels(c.Context(), spec.BaseURL+"/models", slug == "anthropic", apiKey)
	}
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}

	ids := make([]string, 0, len(upstream))
	for _, m := range upstream {
		ids = append(ids, m.ID)
	}
	cat, err := modelcatalog.Store(c.Context(), h.app.Repos.Settings, slug, ids)
	if err != nil {
		return err
	}

	priced := 0
	if slug == "openrouter" && len(upstream) > 0 {
		priced, err = h.importUpstreamPricing(c.Context(), slug, upstream)
		if err != nil {
			return err
		}
	}
	if priced > 0 {
		auditRecord(c.Context(), h.app, actorFrom(c), "pricing.import_upstream", slug, map[string]string{"count": strconv.Itoa(priced)})
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "provider.models_sync", slug, map[string]int{"count": len(ids)})

	return dtos.OK(c, fiber.Map{"models": cat.Models, "fetched_at": cat.FetchedAt, "priced": priced})
}

// CustomModelsUpdate applies per-model active/disabled changes
// (PATCH /v1/custom-providers/:id/models). Only models already in the stored
// catalog can be toggled; unknown ids are a client error.
func (h *providersHandler) CustomModelsUpdate(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.ProviderModelStates
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	provider, err := h.app.Repos.Providers.Get(c.Context(), id.String())
	if err != nil {
		return err
	}

	updates := make([]modelcatalog.StateUpdate, 0, len(req.Models))
	for _, m := range req.Models {
		if m.ID == "" {
			return apperr.New(apperr.KindUnprocessable, "model id is required")
		}
		if m.State != modelcatalog.StateActive && m.State != modelcatalog.StateDisabled {
			return apperr.New(apperr.KindUnprocessable, "state must be active or disabled")
		}
		updates = append(updates, modelcatalog.StateUpdate{ID: m.ID, State: m.State})
	}

	cat, err := modelcatalog.SetStates(c.Context(), h.app.Repos.Settings, provider.Slug, updates)
	switch {
	case errors.Is(err, modelcatalog.ErrNoCatalog):
		return apperr.New(apperr.KindUnprocessable, "no stored catalog for this provider; sync from /models first")
	case errors.Is(err, modelcatalog.ErrUnknownModel):
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	case err != nil:
		return err
	}
	return dtos.OK(c, fiber.Map{"models": cat.Models, "fetched_at": cat.FetchedAt})
}

// CatalogModels serves GET /v1/providers/:id/models — the CustomModels
// counterpart for catalog providers, which are keyed by slug rather than a
// custom-provider uuid. A provider with no stored catalog yet (never synced)
// answers with an empty list so the dashboard renders its empty state.
func (h *providersHandler) CatalogModels(c fiber.Ctx) error {
	slug := c.Params("id")
	if _, ok := catalog.Lookup(slug); !ok {
		return apperr.ErrNotFound
	}
	cat, err := modelcatalog.Load(c.Context(), h.app.Repos.Settings, slug)
	if errors.Is(err, modelcatalog.ErrNoCatalog) {
		return dtos.OK(c, fiber.Map{"models": []modelcatalog.ModelEntry{}, "fetched_at": nil})
	}
	if err != nil {
		return err
	}

	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	page, total, enabled := catalogPage(cat.Models, c.Query("search"), c.Query("state"), offset, limit)
	return dtos.OK(c, fiber.Map{
		"models":     page,
		"total":      total,
		"enabled":    enabled,
		"count":      len(cat.Models),
		"fetched_at": cat.FetchedAt,
	})
}

// CatalogModelsUpdate applies per-model active/disabled changes
// (PATCH /v1/providers/:id/models) for catalog providers — the
// CustomModelsUpdate counterpart keyed by slug.
func (h *providersHandler) CatalogModelsUpdate(c fiber.Ctx) error {
	slug := c.Params("id")
	if _, ok := catalog.Lookup(slug); !ok {
		return apperr.ErrNotFound
	}
	var req dtos.ProviderModelStates
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	updates := make([]modelcatalog.StateUpdate, 0, len(req.Models))
	for _, m := range req.Models {
		if m.ID == "" {
			return apperr.New(apperr.KindUnprocessable, "model id is required")
		}
		if m.State != modelcatalog.StateActive && m.State != modelcatalog.StateDisabled {
			return apperr.New(apperr.KindUnprocessable, "state must be active or disabled")
		}
		updates = append(updates, modelcatalog.StateUpdate{ID: m.ID, State: m.State})
	}

	cat, err := modelcatalog.SetStates(c.Context(), h.app.Repos.Settings, slug, updates)
	switch {
	case errors.Is(err, modelcatalog.ErrNoCatalog):
		return apperr.New(apperr.KindUnprocessable, "no stored catalog for this provider; sync from /models first")
	case errors.Is(err, modelcatalog.ErrUnknownModel):
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	case err != nil:
		return err
	}
	return dtos.OK(c, fiber.Map{"models": cat.Models, "fetched_at": cat.FetchedAt})
}

// --- Model test (dashboard playground) ---

// modelTestMessageCap bounds one test conversation so a test stays small and
// cannot double as a free relay through the operator's credentials.
const (
	modelTestMaxMessages = 20
	modelTestMaxChars    = 4000
)

// validateModelTestMessages checks the conversation shape the upstream
// service will forward.
func validateModelTestMessages(msgs []dtos.ModelTestMessage) error {
	if len(msgs) == 0 {
		return apperr.New(apperr.KindUnprocessable, "at least one message is required")
	}
	if len(msgs) > modelTestMaxMessages {
		return apperr.New(apperr.KindUnprocessable, "at most %d messages per test", modelTestMaxMessages)
	}
	for _, m := range msgs {
		if m.Role != "user" && m.Role != "assistant" {
			return apperr.New(apperr.KindUnprocessable, "message role must be user or assistant")
		}
		if strings.TrimSpace(m.Content) == "" {
			return apperr.New(apperr.KindUnprocessable, "message content is required")
		}
		if len(m.Content) > modelTestMaxChars {
			return apperr.New(apperr.KindUnprocessable, "message content exceeds %d characters", modelTestMaxChars)
		}
	}
	return nil
}

// runModelTest validates the request and issues one small chat completion
// against the already-resolved upstream endpoint and credential. Shared by
// the catalog and custom-provider handlers; the response carries the
// assistant reply, latency, and token usage so the playground can render
// them inline.
func (h *providersHandler) runModelTest(c fiber.Ctx, baseURL, apiKey string, anthropic bool) error {
	var req dtos.ModelTestRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	if err := validateModelTestMessages(req.Messages); err != nil {
		return err
	}
	if baseURL == "" {
		return apperr.New(apperr.KindUnprocessable, "no base_url configured for this provider; add an account with a base URL first")
	}

	result, err := h.app.Services.Upstream.ChatCompletion(c.Context(), baseURL, anthropic, apiKey, req.Model, req.Messages)
	if err != nil {
		return err
	}
	return dtos.OK(c, result)
}

// CatalogModelTest issues one test chat completion for a catalog provider
// model (POST /v1/providers/:id/models/test, :id = slug). The account's
// base_url override wins — it is what the gateway routes through — with the
// catalog spec's default as the fallback.
func (h *providersHandler) CatalogModelTest(c fiber.Ctx) error {
	slug := c.Params("id")
	spec, ok := catalog.Lookup(slug)
	if !ok {
		return apperr.ErrNotFound
	}

	base := h.usableBaseURL(c.Context(), slug)
	if base == "" {
		base = spec.BaseURL
	}
	return h.runModelTest(c, base, h.usableAPIKey(c.Context(), slug), spec.Dialect == "anthropic")
}

// CustomModelTest issues one test chat completion for a custom provider model
// (POST /v1/custom-providers/:id/models/test). Dialect resolution mirrors the
// gateway: the operator-set api_kind may carry the "custom-" marker,
// whitespace, or different casing.
func (h *providersHandler) CustomModelTest(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}
	provider, err := h.app.Repos.Providers.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	if provider.BaseURL == "" {
		return apperr.New(apperr.KindUnprocessable, "provider has no base_url configured")
	}

	kind := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(provider.APIKind)), "custom-")
	anthropic := kind == "anthropic"
	return h.runModelTest(c, provider.BaseURL, h.usableAPIKey(c.Context(), provider.Slug), anthropic)
}

// --- Provider-scoped bulk account operations ---

func (h *providersHandler) AccountsBulkDisable(c fiber.Ctx) error {
	provider := c.Params("id")
	updated, err := h.app.Repos.Accounts.SetDisabledByProvider(c.Context(), provider, true)
	if err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.bulk_disable", provider, map[string]any{"disabled": true, "updated": updated})
	return dtos.OK(c, fiber.Map{"updated": updated})
}

func (h *providersHandler) AccountsBulkEnable(c fiber.Ctx) error {
	provider := c.Params("id")
	updated, err := h.app.Repos.Accounts.SetDisabledByProvider(c.Context(), provider, false)
	if err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.bulk_enable", provider, map[string]any{"disabled": false, "updated": updated})
	return dtos.OK(c, fiber.Map{"updated": updated})
}

func (h *providersHandler) AccountsBulkDeleteDisabled(c fiber.Ctx) error {
	provider := c.Params("id")
	deleted, err := h.app.Repos.Accounts.DeleteDisabled(c.Context(), provider)
	if err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.delete_disabled", provider, map[string]int64{"deleted": deleted})
	return dtos.OK(c, fiber.Map{"deleted": deleted})
}

func (h *providersHandler) AccountsBulkDeleteAll(c fiber.Ctx) error {
	provider := c.Params("id")
	deleted, err := h.app.Repos.Accounts.DeleteAll(c.Context(), provider)
	if err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.delete_all", provider, map[string]int64{"deleted": deleted})
	return dtos.OK(c, fiber.Map{"deleted": deleted})
}
