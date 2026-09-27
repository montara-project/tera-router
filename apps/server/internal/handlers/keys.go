package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

type keysHandler struct {
	app *app.Application
}

// keyView renders the web UI ApiKey model.
func keyView(k repositories.APIKeyWithPlan) fiber.Map {
	status := "active"
	if k.Disabled {
		status = "disabled"
	}
	planLabel, planNote := "No plan", "Custom limits"
	if k.PlanName != nil {
		planLabel = *k.PlanName
		planNote = "Plan defaults"
		if k.PlanNote != nil && *k.PlanNote != "" {
			planNote = *k.PlanNote
		}
	}
	return fiber.Map{
		"id":         k.ID,
		"name":       k.Name,
		"status":     status,
		"keyPreview": k.Display,
		"planLabel":  planLabel,
		"planNote":   planNote,
		"createdAt":  k.CreatedAt,
		"planId":     k.PlanID,
		"lastUsedAt": k.LastUsedAt,
	}
}

func (h *keysHandler) Index(c fiber.Ctx) error {
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	keys, total, err := h.app.Services.Keys.List(c.Context(), q.Offset, q.Limit)
	if err != nil {
		return err
	}

	out := make([]fiber.Map, 0, len(keys))
	for _, k := range keys {
		out = append(out, keyView(k))
	}
	return dtos.List(c, out, dtos.ListMeta(total, q.Offset, q.Limit))
}

func (h *keysHandler) Store(c fiber.Ctx) error {
	var req dtos.CreateKey
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	created, err := h.app.Services.Keys.Create(c.Context(), actorFrom(c), req.Name, req.PlanID, req.Scopes)
	if err != nil {
		return err
	}

	body := fiber.Map{
		"id":         created.Key.ID,
		"name":       created.Key.Name,
		"status":     "active",
		"keyPreview": created.Display,
		"fullKey":    created.Plaintext,
		"planLabel":  "No plan",
		"planNote":   "Custom limits",
		"createdAt":  created.Key.CreatedAt,
	}
	return dtos.Created(c, body, "Key created")
}

func (h *keysHandler) Get(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	key, err := h.app.Services.Keys.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"id":         key.ID,
		"name":       key.Name,
		"status":     statusLabel(key.Disabled),
		"keyPreview": key.Display,
		"createdAt":  key.CreatedAt,
	})
}

func (h *keysHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.UpdateKey
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	key, err := h.app.Services.Keys.Update(c.Context(), actorFrom(c), id.String(), req.Name, req.PlanID, req.Scopes, req.Disabled)
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"id":     key.ID,
		"name":   key.Name,
		"status": statusLabel(key.Disabled),
	})
}

func (h *keysHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Services.Keys.Delete(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.Deleted(c, "Key deleted")
}

// Reveal decrypts the stored key plaintext for explicit recovery.
func (h *keysHandler) Reveal(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	plaintext, err := h.app.Services.Keys.Reveal(c.Context(), actorFrom(c), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"id": id.String(), "fullKey": plaintext})
}

func statusLabel(disabled bool) string {
	if disabled {
		return "disabled"
	}
	return "active"
}
