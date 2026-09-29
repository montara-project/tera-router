package handlers

import (
	"fmt"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
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
		"id":           k.ID,
		"name":         k.Name,
		"status":       status,
		"key_preview":  k.Display,
		"plan_label":   planLabel,
		"plan_note":    planNote,
		"created_at":   k.CreatedAt,
		"plan_id":      k.PlanID,
		"last_used_at": k.LastUsedAt,
	}
}

func (h *keysHandler) Index(c fiber.Ctx) error {
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	keys, total, err := h.app.Repos.APIKeys.List(c.Context(), q.Offset, q.Limit)
	if err != nil {
		return err
	}

	out := make([]fiber.Map, 0, len(keys))
	for _, k := range keys {
		out = append(out, keyView(k))
	}
	return dtos.List(c, out, dtos.ListMeta(total, q.Offset, q.Limit))
}

// Store mints a new API key. Only hashes and the envelope-encrypted copy are
// persisted; the plaintext is shown once and recoverable later only via
// Reveal.
func (h *keysHandler) Store(c fiber.Ctx) error {
	var req dtos.CreateKey
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	gen, err := apikey.Generate()
	if err != nil {
		return err
	}
	sealed, err := h.app.Secrets.SealString(gen.Plaintext)
	if err != nil {
		return err
	}

	key := models.APIKey{
		ID:         uuid.NewString(),
		Name:       req.Name,
		KeyHash:    gen.Hash,
		LookupHash: gen.Lookup,
		Display:    gen.Display,
		Scopes:     req.Scopes,
		Secret:     toModelsSealed(sealed),
	}
	if req.PlanID != "" {
		if _, err := h.app.Repos.Plans.Get(c.Context(), req.PlanID); err != nil {
			return fmt.Errorf("plan %s: %w", req.PlanID, err)
		}
		key.PlanID = &req.PlanID
	}

	if err := h.app.Repos.APIKeys.Insert(c.Context(), key); err != nil {
		return err
	}

	auditRecord(c.Context(), h.app, actorFrom(c), "key.create", key.ID, map[string]string{"name": req.Name})
	return dtos.Created(c, fiber.Map{
		"id":          key.ID,
		"name":        key.Name,
		"status":      "active",
		"key_preview": gen.Display,
		"full_key":    gen.Plaintext,
		"plan_label":  "No plan",
		"plan_note":   "Custom limits",
		"created_at":  key.CreatedAt,
	}, "Key created")
}

func (h *keysHandler) Get(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	key, err := h.app.Repos.APIKeys.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"id":          key.ID,
		"name":        key.Name,
		"status":      statusLabel(key.Disabled),
		"key_preview": key.Display,
		"created_at":  key.CreatedAt,
	})
}

// Update mutates name/plan/scopes/disabled on an existing key.
func (h *keysHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.UpdateKey
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	key, err := h.app.Repos.APIKeys.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	if req.Name != "" {
		key.Name = req.Name
	}
	if req.PlanID != nil {
		if *req.PlanID == "" {
			key.PlanID = nil
		} else {
			if _, err := h.app.Repos.Plans.Get(c.Context(), *req.PlanID); err != nil {
				return fmt.Errorf("plan %s: %w", *req.PlanID, err)
			}
			key.PlanID = req.PlanID
		}
	}
	if req.Scopes != nil {
		key.Scopes = *req.Scopes
	}
	if req.Disabled != nil {
		key.Disabled = *req.Disabled
	}

	if err := h.app.Repos.APIKeys.Update(c.Context(), key); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "key.update", id.String(), map[string]any{"disabled": key.Disabled})
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

	if err := h.app.Repos.APIKeys.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "key.delete", id.String(), nil)
	return dtos.Deleted(c, "Key deleted")
}

// Reveal decrypts the stored key plaintext for explicit, audit-logged
// recovery. Auth never consults these columns.
func (h *keysHandler) Reveal(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	key, err := h.app.Repos.APIKeys.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	if key.Secret.Empty() {
		return apperr.New(apperr.KindUnprocessable, "key has no recoverable secret")
	}

	plaintext, err := h.app.Secrets.OpenString(fromModelsSealed(key.Secret))
	if err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "key.reveal", id.String(), nil)
	return dtos.OK(c, fiber.Map{"id": id.String(), "full_key": plaintext})
}

func statusLabel(disabled bool) string {
	if disabled {
		return "disabled"
	}
	return "active"
}
