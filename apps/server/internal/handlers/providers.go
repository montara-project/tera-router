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

	// Connected seedable catalog providers always have their seeded
	// custom_providers row; backfill rows missing it (databases predating
	// connect-time seeding) so their detail page addresses them by uuid.
	customSlugs := make(map[string]bool, len(customs))
	for _, c := range customs {
		customSlugs[c.Slug] = true
	}
	reseeded := false
	for _, spec := range catalog.Listed() {
		if counts[spec.Slug] == 0 || customSlugs[spec.Slug] || !catalog.Seedable(spec.Slug) {
			continue
		}
		row, err := ensureCustomProviderRow(c.Context(), h.app, actorFrom(c), spec.Slug)
		if err != nil {
			return err
		}
		reseeded = reseeded || row != nil
	}
	if reseeded {
		customs, err = h.app.Repos.Providers.List(c.Context())
		if err != nil {
			return err
		}
	}
	customBySlug := make(map[string]models.CustomProvider, len(customs))
	customSlugs = make(map[string]bool, len(customs))
	for _, c := range customs {
		customBySlug[c.Slug] = c
		customSlugs[c.Slug] = true
	}

	connected, available := catalogOverviewViews(catalog.Listed(), counts, customBySlug)

	// Custom providers with a slug outside the catalog render as their own
	// connected entries; catalog slugs are already covered above.
	for _, c := range customs {
		if _, ok := catalog.Lookup(c.Slug); ok {
			continue
		}
		connected = append(connected, dtos.ProviderView{
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
	return dtos.OK(c, dtos.ProviderOverview{Connected: connected, Available: available})
}

// catalogOverviewViews builds the catalog-provider views for the providers
// page, split into connected and available. A custom_providers row sharing a
// catalog slug is the provider's persisted identity — seeded at connect time —
// so its uuid and name take over the view and the detail page can load it
// from the database by id.
func catalogOverviewViews(listed []dtos.CatalogProvider, counts map[string]int, customBySlug map[string]models.CustomProvider) (connected, available []dtos.ProviderView) {
	connected = make([]dtos.ProviderView, 0)
	available = make([]dtos.ProviderView, 0)
	for _, spec := range listed {
		view := dtos.ProviderView{
			ID:           "prov-" + spec.Slug,
			Name:         spec.Name,
			Slug:         spec.Slug,
			Connected:    counts[spec.Slug] > 0 || customBySlug[spec.Slug].ID != "",
			Accounts:     counts[spec.Slug],
			Capabilities: spec.Capabilities,
			Official:     spec.Official,
			Notice:       spec.Notice,
			APIKind:      spec.Dialect,
		}
		if row, ok := customBySlug[spec.Slug]; ok {
			view.ID = row.ID
			view.Name = row.Name
		}
		if view.Connected {
			connected = append(connected, view)
			continue
		}
		available = append(available, view)
	}
	return connected, available
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

// CustomShowBySlug resolves a custom provider by its unique slug
// (GET /v1/custom-providers/by-slug/:slug) — used by list cells that only
// carry the slug, e.g. pricing overrides.
func (h *providersHandler) CustomShowBySlug(c fiber.Ctx) error {
	slug := c.Params("slug")
	if slug == "" {
		return apperr.ErrBadRequest
	}
	provider, err := h.app.Repos.Providers.GetBySlug(c.Context(), slug)
	if err != nil {
		return err
	}
	return dtos.OK(c, provider)
}

// CustomShow returns a single custom provider (GET /v1/custom-providers/:id).
func (h *providersHandler) CustomShow(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}
	provider, err := h.app.Repos.Providers.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, provider)
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

	var upstream []services.UpstreamModel
	if modelsSyncProviders[provider.Slug] {
		// A catalog-connected provider (seeded at connect time, or a custom
		// row reusing the slug) syncs through its per-provider source
		// connector — a plain /models fetch cannot express Cline's union list
		// or Cloudflare's account-scoped endpoint.
		upstream, err = h.syncProviderModels(c.Context(), provider.Slug)
	} else {
		if provider.BaseURL == "" {
			return apperr.New(apperr.KindUnprocessable, "provider has no base_url configured")
		}
		apiKey, keyErr := h.customProviderSyncKey(c.Context(), provider.Slug)
		if keyErr != nil {
			return keyErr
		}
		if apiKey == "" {
			return apperr.New(apperr.KindUnprocessable, "no usable credential for this provider; add an API key first")
		}

		// Match the gateway's dialect resolution (customProviderDialect): the
		// operator-set api_kind may carry the "custom-" marker, whitespace, or
		// different casing the raw comparison would miss.
		kind := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(provider.APIKind)), "custom-")
		anthropic := kind == "anthropic"
		endpoint := services.V1Join(provider.BaseURL, "models")
		upstream, err = h.app.Services.Upstream.ListModels(c.Context(), endpoint, anthropic, apiKey)
	}
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

// customProviderSyncKey opens the first usable credential of the provider's
// accounts — API keys live in Secret, OAuth tokens in Token — mirroring the
// account probe's lookup order. Empty when no account carries a credential.
func (h *providersHandler) customProviderSyncKey(ctx context.Context, providerSlug string) (string, error) {
	accounts, err := h.app.Repos.Accounts.ListUsable(ctx, providerSlug)
	if err != nil {
		return "", err
	}
	apiKey := ""
	for _, account := range accounts {
		if !account.Secret.Empty() {
			apiKey, err = h.app.Secrets.OpenString(account.Secret)
		} else if !account.Token.Empty() {
			apiKey, err = h.app.Secrets.OpenString(account.Token)
		}
		if apiKey != "" || err != nil {
			break
		}
	}
	return apiKey, err
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
			if key, err := h.app.Secrets.OpenString(account.Secret); err == nil && key != "" {
				return key
			}
		}
		if !account.Token.Empty() {
			if key, err := h.app.Secrets.OpenString(account.Token); err == nil && key != "" {
				return key
			}
		}
	}
	return ""
}

// modelsSyncProviders are the providers whose model list the dashboard can
// sync (POST /v1/providers/:id/models/sync and the custom-provider
// equivalent), each with its own source ported from IDRouter's connectors:
// OpenRouter's public /models (whose pricing is imported into the overrides),
// the Ollama family's /api/tags, Cline's union of /models and the
// recommended-models free list, Cloudflare's account-scoped /models, and the
// OpenAI/Anthropic/NVIDIA official /v1/models.
var modelsSyncProviders = map[string]bool{
	"openrouter":   true,
	"ollama":       true,
	"ollama-local": true,
	"cline":        true,
	"cloudflare":   true,
	"openai":       true,
	"anthropic":    true,
	"nvidia":       true,
}

// syncProviderModels fetches a provider's upstream model list through its
// per-provider source connector. The credential comes from the provider's
// usable accounts; Cloudflare's catalog endpoint embeds {account_id}, so the
// stored account's base_url override carries the real URL there. Returned
// errors are client-facing 422s.
func (h *providersHandler) syncProviderModels(ctx context.Context, slug string) ([]services.UpstreamModel, error) {
	spec, _ := catalog.Lookup(slug)
	apiKey := h.usableAPIKey(ctx, slug)

	const noCredential = "no usable credential for this provider; add an API key first"
	switch slug {
	case "openrouter":
		// The list is public (a stored key is still sent for rate limiting).
		return h.app.Services.Upstream.ListModels(ctx, spec.BaseURL+"/models", false, apiKey)
	case "ollama", "ollama-local":
		return h.app.Services.Upstream.ListOllamaModels(ctx, spec.BaseURL, apiKey)
	case "cline":
		if apiKey == "" {
			return nil, apperr.New(apperr.KindUnprocessable, noCredential)
		}
		return h.app.Services.Upstream.ListClineModels(ctx, spec.BaseURL, apiKey)
	case "cloudflare":
		if apiKey == "" {
			return nil, apperr.New(apperr.KindUnprocessable, noCredential)
		}
		base := spec.BaseURL
		if u := h.usableBaseURL(ctx, slug); u != "" {
			base = strings.TrimSuffix(u, "/")
		}
		return h.app.Services.Upstream.ListModels(ctx, base+"/models", false, apiKey)
	case "openai", "anthropic", "nvidia":
		if apiKey == "" {
			return nil, apperr.New(apperr.KindUnprocessable, noCredential)
		}
		// The official /v1/models of each; the anthropic dialect only swaps
		// the auth headers (x-api-key + anthropic-version) — the response
		// envelope is the same {"data":[{id}]} shape.
		return h.app.Services.Upstream.ListModels(ctx, services.V1Join(spec.BaseURL, "models"), slug == "anthropic", apiKey)
	}
	return nil, apperr.New(apperr.KindUnprocessable, "provider %s does not support model sync", slug)
}

// ModelsSync refreshes the stored model catalog of a catalog provider.
func (h *providersHandler) ModelsSync(c fiber.Ctx) error {
	slug := c.Params("id")
	if !modelsSyncProviders[slug] {
		if _, ok := catalog.Lookup(slug); ok {
			return apperr.New(apperr.KindUnprocessable, "provider %s does not support model sync", slug)
		}
		return apperr.ErrNotFound
	}

	upstream, err := h.syncProviderModels(c.Context(), slug)
	if err != nil {
		return err
	}

	ids := make([]string, 0, len(upstream))
	for _, m := range upstream {
		ids = append(ids, m.ID)
	}
	cat, err := modelcatalog.Store(c.Context(), h.app.Repos.Settings, slug, ids)
	if err != nil {
		return err
	}

	// Only OpenRouter's /models advertises rates today; the import is a no-op
	// for the rest.
	priced, err := h.importUpstreamPricing(c.Context(), slug, upstream)
	if err != nil {
		return err
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
	base := provider.BaseURL
	// A template endpoint (e.g. Cloudflare's {account_id}) resolves against
	// the account's base_url override, mirroring sync and routing.
	if strings.Contains(base, "{") {
		if u := h.usableBaseURL(c.Context(), provider.Slug); u != "" {
			base = u
		}
	}
	if base == "" {
		return apperr.New(apperr.KindUnprocessable, "provider has no base_url configured")
	}

	kind := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(provider.APIKind)), "custom-")
	anthropic := kind == "anthropic"
	return h.runModelTest(c, base, h.usableAPIKey(c.Context(), provider.Slug), anthropic)
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
