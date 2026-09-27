package handlers

import (
	"encoding/json"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/validator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
)

type accountsHandler struct {
	app *app.Application
}

type accountRequest struct {
	Provider    string         `json:"provider"`
	Label       string         `json:"label"`
	AuthKind    string         `json:"auth_kind"`
	APIKey      string         `json:"api_key"`
	Token       string         `json:"token"`
	Refresh     string         `json:"refresh"`
	Metadata    map[string]any `json:"metadata"`
	Priority    int            `json:"priority"`
	ProxyPoolID string         `json:"proxy_pool_id"`
	Disabled    *bool          `json:"disabled"`
}

func (d *accountRequest) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
	v.Field("auth_kind").WithinS("api_key", "oauth", "none")
}

func (d *accountRequest) toInput() services.AccountInput {
	return services.AccountInput{
		Provider:    d.Provider,
		Label:       d.Label,
		AuthKind:    models.AuthKind(orDefault(d.AuthKind, "api_key")),
		APIKey:      d.APIKey,
		Token:       d.Token,
		Refresh:     d.Refresh,
		Metadata:    encodeMetadata(d.Metadata),
		Priority:    d.Priority,
		ProxyPoolID: d.ProxyPoolID,
	}
}

func encodeMetadata(meta map[string]any) string {
	if len(meta) == 0 {
		return ""
	}
	raw, err := json.Marshal(meta)
	if err != nil {
		return ""
	}
	return string(raw)
}

func accountView(a models.Account) fiber.Map {
	status := "active"
	if a.Disabled {
		status = "paused"
	}
	var metadata any
	metadata = fiber.Map{}
	if a.Metadata != "" {
		_ = json.Unmarshal([]byte(a.Metadata), &metadata)
	}
	return fiber.Map{
		"id":               a.ID,
		"provider":         a.Provider,
		"label":            a.Label,
		"auth_kind":        a.AuthKind,
		"key_fingerprint":  a.KeyFingerprint,
		"token_expires_at": a.TokenExpiresAt,
		"metadata":         metadata,
		"priority":         a.Priority,
		"status":           status,
		"disabled":         a.Disabled,
		"proxy_pool_id":    a.ProxyPoolID,
		"needs_reconnect":  a.NeedsReconnect,
		"created_at":       a.CreatedAt,
		"updated_at":       a.UpdatedAt,
	}
}

func (h *accountsHandler) Index(c fiber.Ctx) error {
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	accounts, total, err := h.app.Services.Accounts.List(c.Context(), q.Offset, q.Limit)
	if err != nil {
		return err
	}

	out := make([]fiber.Map, 0, len(accounts))
	for _, a := range accounts {
		out = append(out, accountView(a))
	}
	return dtos.List(c, out, dtos.ListMeta(total, q.Offset, q.Limit))
}

func (h *accountsHandler) Store(c fiber.Ctx) error {
	var req accountRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	account, err := h.app.Services.Accounts.Create(c.Context(), actorFrom(c), req.toInput())
	if err != nil {
		return err
	}
	return dtos.Created(c, accountView(account), "Account created")
}

type bulkAccountsRequest struct {
	Accounts []accountRequest `json:"accounts"`
}

func (d *bulkAccountsRequest) Validate(v *validator.MapValidator) {
	// Items are validated individually in the service layer.
}

func (h *accountsHandler) Bulk(c fiber.Ctx) error {
	var req bulkAccountsRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	if len(req.Accounts) == 0 {
		return apperr.New(apperr.KindBadRequest, "accounts must not be empty")
	}

	inputs := make([]services.AccountInput, 0, len(req.Accounts))
	for i := range req.Accounts {
		inputs = append(inputs, req.Accounts[i].toInput())
	}

	accounts, err := h.app.Services.Accounts.BulkCreate(c.Context(), actorFrom(c), inputs)
	if err != nil {
		return err
	}
	return dtos.Created(c, len(accounts), "Accounts created")
}

type validateKeyRequest struct {
	Provider string         `json:"provider"`
	APIKey   string         `json:"api_key"`
	Metadata map[string]any `json:"metadata"`
}

func (d *validateKeyRequest) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().String()
	v.Field("api_key").Required().String()
}

func (h *accountsHandler) ValidateKey(c fiber.Ctx) error {
	var req validateKeyRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	result, err := h.app.Services.Accounts.ValidateKey(c.Context(), req.Provider, req.APIKey, encodeMetadata(req.Metadata))
	if err != nil {
		return err
	}
	return dtos.OK(c, result)
}

func (h *accountsHandler) Get(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	account, err := h.app.Services.Accounts.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, accountView(account))
}

func (h *accountsHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req accountRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	account, err := h.app.Services.Accounts.Update(c.Context(), actorFrom(c), id.String(), req.toInput(), req.Disabled)
	if err != nil {
		return err
	}
	return dtos.OK(c, accountView(account))
}

func (h *accountsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Services.Accounts.Delete(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.Deleted(c, "Account deleted")
}

// Test probes the stored credential against the upstream.
func (h *accountsHandler) Test(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	result, err := h.app.Services.Accounts.Test(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, result)
}

// Reveal decrypts the stored credential (audit-logged).
func (h *accountsHandler) Reveal(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	plaintext, err := h.app.Services.Accounts.Reveal(c.Context(), actorFrom(c), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"id": id.String(), "api_key": plaintext})
}

// Quota returns the account's quota snapshot.
func (h *accountsHandler) Quota(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	quota, err := h.app.Services.Accounts.AccountQuota(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, quota)
}

// QuotaReset clears in-memory quota strikes for the account.
func (h *accountsHandler) QuotaReset(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Services.Accounts.AccountQuotaReset(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "Quota state reset")
}
