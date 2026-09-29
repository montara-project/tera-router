package handlers

import (
	"encoding/json"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type providersHandler struct {
	app *app.Application
}

// ProviderView matches the web UI Provider model: id, name, slug, connected,
// accounts, capabilities, official.
type ProviderView struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Slug         string   `json:"slug"`
	Connected    bool     `json:"connected"`
	Accounts     int      `json:"accounts,omitempty"`
	Capabilities []string `json:"capabilities"`
	Official     bool     `json:"official,omitempty"`
	Notice       string   `json:"notice,omitempty"`
}

// customProviderFrom converts a CustomProvider DTO into the stored model.
func customProviderFrom(d dtos.CustomProvider) models.CustomProvider {
	p := models.CustomProvider{
		Name:     d.Name,
		Slug:     d.Slug,
		BaseURL:  d.BaseURL,
		APIKind:  orDefault(d.APIKind, "openai"),
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

	overview := struct {
		Connected []ProviderView `json:"connected"`
		Available []ProviderView `json:"available"`
	}{
		Connected: []ProviderView{},
		Available: []ProviderView{},
	}

	for _, spec := range Catalog() {
		view := ProviderView{
			ID:           "prov-" + spec.Slug,
			Name:         spec.Name,
			Slug:         spec.Slug,
			Connected:    counts[spec.Slug] > 0 || customSlugs[spec.Slug],
			Accounts:     counts[spec.Slug],
			Capabilities: spec.Capabilities,
			Official:     spec.Official,
			Notice:       spec.Notice,
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
		if _, ok := CatalogLookup(c.Slug); ok {
			continue
		}
		overview.Connected = append(overview.Connected, ProviderView{
			ID:           c.ID,
			Name:         c.Name,
			Slug:         c.Slug,
			Connected:    true,
			Accounts:     counts[c.Slug],
			Capabilities: []string{"chat"},
			Official:     true,
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

	provider := customProviderFrom(req)
	provider.ID = id.String()
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
	auditRecord(c.Context(), h.app, actorFrom(c), "account.bulk_disable", provider, map[string]any{"disabled": false, "updated": updated})
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
