package handlers

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
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
		Priority: d.Priority,
		Pricing:  encodeJSON(d.Pricing),
		Metadata: encodeJSON(d.Metadata),
		Enabled:  true,
	}
	if d.Enabled != nil {
		p.Enabled = *d.Enabled
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
	if d.Slug != "" {
		p.Slug = slugify(d.Slug)
	}
	if d.BaseURL != "" {
		p.BaseURL = d.BaseURL
	}
	if d.Pricing != nil {
		p.Pricing = encodeJSON(d.Pricing)
	}
	if d.Metadata != nil {
		p.Metadata = encodeJSON(d.Metadata)
	}
	if d.Priority != 0 {
		p.Priority = d.Priority
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

	for _, spec := range catalog.All() {
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

func (h *providersHandler) CustomDelete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Repos.Providers.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "custom_provider.delete", id.String(), nil)
	return dtos.Deleted(c, "Provider deleted")
}

// CustomModels returns the provider's stored model catalog with each model's
// active/disabled state (GET /v1/custom-providers/:id/models). The catalog is
// what the gateway uses to resolve bare model ids and to advertise them on
// /v1/models.
//
// Query params: search (case-insensitive substring on the model id), offset
// and limit (limit defaults to 10, capped at 100) for the dashboard's paged
// catalog view. The response always reports totals over the whole catalog so
// a single page is enough to render the header and pagination.
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
	page, total, enabled := catalogPage(cat.Models, c.Query("search"), offset, limit)
	return dtos.OK(c, fiber.Map{
		"models":     page,
		"total":      total,
		"enabled":    enabled,
		"count":      len(cat.Models),
		"fetched_at": cat.FetchedAt,
	})
}

// catalogPage filters one catalog by a case-insensitive id substring and
// slices out one page. It returns the page, the filtered total (for page
// count), and the enabled count over the whole catalog (for the header).
func catalogPage(models []modelcatalog.ModelEntry, search string, offset, limit int) (page []modelcatalog.ModelEntry, total, enabled int) {
	if models == nil {
		models = []modelcatalog.ModelEntry{}
	}
	for _, m := range models {
		if m.State == modelcatalog.StateActive {
			enabled++
		}
	}

	filtered := models
	if q := strings.ToLower(strings.TrimSpace(search)); q != "" {
		filtered = make([]modelcatalog.ModelEntry, 0, len(models))
		for _, m := range models {
			if strings.Contains(strings.ToLower(m.ID), q) {
				filtered = append(filtered, m)
			}
		}
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

	anthropic := provider.APIKind == "anthropic"
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
