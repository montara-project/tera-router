package handlers

import (
	"fmt"
	"strings"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"
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
	planLabel, planNote := "No plan", "No plan limits"
	if k.PlanName != nil {
		planLabel = *k.PlanName
		planNote = "Plan defaults"
		if k.PlanNote != nil && *k.PlanNote != "" {
			planNote = *k.PlanNote
		}
	}
	allowedModels := k.AllowedModels
	if allowedModels == nil {
		allowedModels = []string{}
	}
	skillIDs := k.SkillIDs
	if skillIDs == nil {
		skillIDs = []string{}
	}
	return fiber.Map{
		"id":             k.ID,
		"name":           k.Name,
		"status":         status,
		"key_preview":    k.Display,
		"plan_label":     planLabel,
		"plan_note":      planNote,
		"created_at":     k.CreatedAt,
		"plan_id":        k.PlanID,
		"last_used_at":   k.LastUsedAt,
		"allowed_models": allowedModels,
		"skill_ids":      skillIDs,
	}
}

// maxKeyListLimit is the largest page of keys one request returns. Pickers
// (budget scope, guardrail scope) read the keys whole to offer them as
// choices; at the default ceiling of 100 the rest could not be picked.
const maxKeyListLimit = 1000

// Index lists keys a page at a time. `search` matches the name, the key
// preview or the plan; `status` keeps active or disabled keys; `sort` is
// newest (default), oldest or name. The metadata also carries the counts
// behind the status chips, which ignore the filters.
func (h *keysHandler) Index(c fiber.Ctx) error {
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.ClampTo(maxKeyListLimit)

	filter := repositories.APIKeyFilter{Search: strings.TrimSpace(c.Query("search")), Sort: c.Query("sort")}
	if status := c.Query("status"); status == "active" || status == "disabled" {
		filter.Status = status
	}
	keys, total, err := h.app.Repos.APIKeys.List(c.Context(), filter, q.Offset, q.Limit)
	if err != nil {
		return err
	}
	all, disabled, err := h.app.Repos.APIKeys.StatusCounts(c.Context())
	if err != nil {
		return err
	}

	out := make([]fiber.Map, 0, len(keys))
	for _, k := range keys {
		out = append(out, keyView(k))
	}
	meta := dtos.ListMeta(total, q.Offset, q.Limit)
	meta["total_all"] = all
	meta["total_active"] = all - disabled
	meta["total_disabled"] = disabled
	return dtos.List(c, out, meta)
}

// checkKeyScopes rejects a scopes string naming a scope the gateway does not
// enforce, which would otherwise silently grant nothing.
func checkKeyScopes(scopes string) error {
	if unknown := models.UnknownKeyScope(scopes); unknown != "" {
		return apperr.New(apperr.KindBadRequest, "unknown scope %q: use chat, web, audio, images, embeddings or *", unknown)
	}
	return nil
}

// Store mints a new API key. Only hashes and the envelope-encrypted copy are
// persisted; the plaintext is shown once and recoverable later only via
// Reveal.
func (h *keysHandler) Store(c fiber.Ctx) error {
	var req dtos.CreateKey
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	if err := checkKeyScopes(req.Scopes); err != nil {
		return err
	}

	gen, err := apikey.Generate()
	if err != nil {
		return err
	}
	sealed, err := h.app.Secrets.SealString(gen.Plaintext, sealer.PurposeAPIKey)
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
		Secret:     sealed,
	}
	if req.AllowedModels != nil {
		key.AllowedModels = *req.AllowedModels
	}
	if req.SkillIDs != nil {
		key.SkillIDs = *req.SkillIDs
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

	auditRecord(c, actorFrom(c), "key.create", key.ID, map[string]string{"name": req.Name})
	return dtos.Created(c, fiber.Map{
		"id":          key.ID,
		"name":        key.Name,
		"status":      "active",
		"key_preview": gen.Display,
		"full_key":    gen.Plaintext,
		"plan_label":  "No plan",
		"plan_note":   "No plan limits",
		"created_at":  key.CreatedAt,
	}, "Key created")
}

// Get returns the full detail view for one key: the list payload plus the
// stored scopes and update timestamp the detail page renders.
func (h *keysHandler) Get(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	key, err := h.app.Repos.APIKeys.GetWithPlan(c.Context(), id.String())
	if err != nil {
		return err
	}

	portalToken, err := h.app.Repos.Portal.ForKey(c.Context(), key.ID)
	if err != nil {
		return err
	}

	view := keyView(key)
	view["scopes"] = key.Scopes
	view["updated_at"] = key.UpdatedAt
	view["portal_token"] = portalToken
	return dtos.OK(c, view)
}

// IssuePortal gives the key a new usage-portal token (POST /v1/keys/:id/portal).
// Any previous link stops working.
func (h *keysHandler) IssuePortal(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}
	if _, err := h.app.Repos.APIKeys.Get(c.Context(), id.String()); err != nil {
		return err
	}
	token, err := h.app.Repos.Portal.Issue(c.Context(), id.String())
	if err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "key.portal.issue", id.String(), nil)
	return dtos.OK(c, fiber.Map{"portal_token": token})
}

// RevokePortal removes the key's usage-portal link (DELETE /v1/keys/:id/portal).
func (h *keysHandler) RevokePortal(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}
	if err := h.app.Repos.Portal.Revoke(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "key.portal.revoke", id.String(), nil)
	return dtos.OK(c, fiber.Map{"portal_token": ""})
}

// keyUsageDays is the window GET /v1/keys/:id/usage reports on.
const keyUsageDays = 30

// keyGuardrailDays is the window of the key guardrails tab.
const keyGuardrailDays = 7

// Usage reports one key's requests, tokens and spend over the last 30 days
// (GET /v1/keys/:id/usage).
func (h *keysHandler) Usage(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}
	if _, err := h.app.Repos.APIKeys.GetWithPlan(c.Context(), id.String()); err != nil {
		return err
	}
	from := time.Now().AddDate(0, 0, -keyUsageDays)
	summary, err := h.app.Repos.Usage.SummaryForKey(c.Context(), id.String(), from)
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"days":              keyUsageDays,
		"requests":          summary.Requests,
		"prompt_tokens":     summary.PromptTokens,
		"completion_tokens": summary.CompletionTokens,
		"cost_micros":       summary.CostMicros,
	})
}

// GuardrailStats reports what the guardrails did to one key's traffic over
// the last 7 days (GET /v1/keys/:id/guardrails). Requests counts served plus
// blocked requests: a blocked request never reaches usage records.
func (h *keysHandler) GuardrailStats(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}
	if _, err := h.app.Repos.APIKeys.GetWithPlan(c.Context(), id.String()); err != nil {
		return err
	}
	from := time.Now().AddDate(0, 0, -keyGuardrailDays)
	usage, err := h.app.Repos.Usage.SummaryForKey(c.Context(), id.String(), from)
	if err != nil {
		return err
	}
	decisions, err := h.app.Repos.Guardrails.DecisionsForKey(c.Context(), id.String(), from)
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"days":     keyGuardrailDays,
		"requests": usage.Requests + decisions.Blocked,
		"blocked":  decisions.Blocked,
		"masked":   decisions.Masked,
		"warned":   decisions.Warned,
		"logged":   decisions.Logged,
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
		if err := checkKeyScopes(*req.Scopes); err != nil {
			return err
		}
		key.Scopes = *req.Scopes
	}
	if req.Disabled != nil {
		key.Disabled = *req.Disabled
	}
	if req.AllowedModels != nil {
		key.AllowedModels = *req.AllowedModels
	}
	if req.SkillIDs != nil {
		key.SkillIDs = *req.SkillIDs
	}

	if err := h.app.Repos.APIKeys.Update(c.Context(), key); err != nil {
		return err
	}
	h.app.KeysChanged()
	auditRecord(c, actorFrom(c), "key.update", id.String(), map[string]any{"disabled": key.Disabled})
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
	h.app.KeysChanged()
	auditRecord(c, actorFrom(c), "key.delete", id.String(), nil)
	return dtos.Deleted(c, "Key deleted")
}

// Reveal decrypts the stored key plaintext for explicit, audit-logged
// recovery. Auth never consults these columns. The caller re-enters their
// password (and TOTP code when enabled) on every reveal; see reauthenticate.
func (h *keysHandler) Reveal(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.Reauth
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	needsCode, err := reauthenticate(c, h.app, req.Password, req.OTP, req.ReauthTicket)
	if err != nil {
		return err
	}
	if needsCode {
		return totpRequired(c)
	}

	key, err := h.app.Repos.APIKeys.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	if key.Secret.Empty() {
		return apperr.New(apperr.KindUnprocessable, "key has no recoverable secret")
	}

	plaintext, err := h.app.Secrets.OpenString(key.Secret, sealer.PurposeAPIKey)
	if err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "key.reveal", id.String(), nil)
	return dtos.OK(c, fiber.Map{"id": id.String(), "full_key": plaintext})
}

// Rotate replaces a key's credential with a freshly generated one; the old
// plaintext stops authenticating at once. It mints a new secret, so it needs
// the same re-authentication as Reveal. The new plaintext is returned once.
func (h *keysHandler) Rotate(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.Reauth
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	needsCode, err := reauthenticate(c, h.app, req.Password, req.OTP, req.ReauthTicket)
	if err != nil {
		return err
	}
	if needsCode {
		return totpRequired(c)
	}

	key, err := h.app.Repos.APIKeys.Get(c.Context(), id.String())
	if err != nil {
		return err
	}

	gen, err := apikey.Generate()
	if err != nil {
		return err
	}
	sealed, err := h.app.Secrets.SealString(gen.Plaintext, sealer.PurposeAPIKey)
	if err != nil {
		return err
	}
	key.KeyHash, key.LookupHash, key.Display, key.Secret = gen.Hash, gen.Lookup, gen.Display, sealed

	if err := h.app.Repos.APIKeys.Rotate(c.Context(), key); err != nil {
		return err
	}
	h.app.KeysChanged()
	auditRecord(c, actorFrom(c), "key.rotate", key.ID, nil)
	return dtos.OK(c, fiber.Map{
		"id":          key.ID,
		"key_preview": gen.Display,
		"full_key":    gen.Plaintext,
	})
}

func statusLabel(disabled bool) string {
	if disabled {
		return "disabled"
	}
	return "active"
}
