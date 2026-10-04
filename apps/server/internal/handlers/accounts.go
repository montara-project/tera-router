package handlers

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/catalog"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type accountsHandler struct {
	app *app.Application
}

// accountInput is the decrypted, unsealed form of one credential ready for
// persistence or probing.
type accountInput struct {
	Provider    string
	Label       string
	AuthKind    models.AuthKind
	APIKey      string
	Token       string
	Refresh     string
	Metadata    string // raw JSON
	Priority    int
	ProxyPoolID string
}

// accountInputFrom converts an Account DTO into the internal input, encoding
// the metadata map as JSON. Credential plaintext never leaves this scope
// unsealed.
func accountInputFrom(d dtos.Account) accountInput {
	return accountInput{
		Provider:    d.Provider,
		Label:       d.Label,
		AuthKind:    models.AuthKind(cmp.Or(d.AuthKind, "api_key")),
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

// seal seals one credential into the account's envelope blobs and derives
// the dedup fingerprint/hash.
func sealCredential(a *app.Application, account *models.Account, in accountInput) error {
	if in.APIKey != "" {
		sealed, err := a.Secrets.SealString(in.APIKey)
		if err != nil {
			return err
		}
		account.Secret = sealed
		account.KeyFingerprint = fingerprint(in.APIKey)
		sum := sha256.Sum256([]byte(in.APIKey))
		account.KeyHash = hex.EncodeToString(sum[:])
	}
	if in.Token != "" {
		sealed, err := a.Secrets.SealString(in.Token)
		if err != nil {
			return err
		}
		account.Token = sealed
	}
	if in.Refresh != "" {
		sealed, err := a.Secrets.SealString(in.Refresh)
		if err != nil {
			return err
		}
		account.Refresh = sealed
	}
	return nil
}

// fingerprint is a masked key hint (head…tail) for the dashboard, mirroring
// IDRouter's KeyFingerprint.
func fingerprint(plaintext string) string {
	if len(plaintext) <= 8 {
		return "…"
	}
	return plaintext[:4] + "…" + plaintext[len(plaintext)-4:]
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

	accounts, total, err := h.app.Repos.Accounts.List(c.Context(), q.Offset, q.Limit)
	if err != nil {
		return err
	}

	out := make([]fiber.Map, 0, len(accounts))
	for _, a := range accounts {
		out = append(out, accountView(a))
	}
	return dtos.List(c, out, dtos.ListMeta(total, q.Offset, q.Limit))
}

// Store persists a new upstream credential. Duplicate keys (same sha-256 of
// the plaintext api key) are rejected, mirroring IDRouter's dedup.
func (h *accountsHandler) Store(c fiber.Ctx) error {
	var req dtos.Account
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	in := accountInputFrom(req)
	if in.Provider == "" {
		return apperr.New(apperr.KindBadRequest, "provider is required")
	}

	// A connect on a seedable catalog provider persists its custom_providers
	// row so the dashboard can address it by uuid (provider detail page).
	if _, err := ensureCustomProviderRow(c.Context(), h.app, actorFrom(c), in.Provider); err != nil {
		return err
	}

	account := models.Account{
		ID:       uuid.NewString(),
		Provider: in.Provider,
		Label:    in.Label,
		AuthKind: in.AuthKind,
		Priority: in.Priority,
		Metadata: orEmptyJSON(in.Metadata),
	}
	if in.ProxyPoolID != "" {
		poolID := in.ProxyPoolID
		account.ProxyPoolID = &poolID
	}
	if err := sealCredential(h.app, &account, in); err != nil {
		return err
	}

	if account.KeyHash != "" {
		// Only a genuine miss means "no duplicate"; any other error is a real
		// failure and must not be mistaken for a free slot.
		if _, err := h.app.Repos.Accounts.GetByKeyHash(c.Context(), account.KeyHash); err == nil {
			return apperr.New(apperr.KindConflict, "an account with this key already exists")
		} else if !errors.Is(err, apperr.ErrNotFound) {
			return err
		}
	}

	if err := h.app.Repos.Accounts.Insert(c.Context(), account); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.create", account.ID, map[string]string{"provider": account.Provider, "label": account.Label})
	return dtos.Created(c, accountView(account), "Account created")
}

func (h *accountsHandler) Bulk(c fiber.Ctx) error {
	var req dtos.BulkAccounts
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	if len(req.Accounts) == 0 {
		return apperr.New(apperr.KindBadRequest, "accounts must not be empty")
	}

	accounts := make([]models.Account, 0, len(req.Accounts))
	for _, item := range req.Accounts {
		in := accountInputFrom(item)
		account := models.Account{
			ID:       uuid.NewString(),
			Provider: in.Provider,
			Label:    in.Label,
			AuthKind: in.AuthKind,
			Priority: in.Priority,
			Metadata: orEmptyJSON(in.Metadata),
		}
		if in.ProxyPoolID != "" {
			poolID := in.ProxyPoolID
			account.ProxyPoolID = &poolID
		}
		if err := sealCredential(h.app, &account, in); err != nil {
			return err
		}
		accounts = append(accounts, account)
	}

	if err := h.app.Repos.Accounts.BulkInsert(c.Context(), accounts); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.bulk_create", fmt.Sprintf("%d accounts", len(accounts)), map[string]int{"count": len(accounts)})
	return dtos.Created(c, len(accounts), "Accounts created")
}

func (h *accountsHandler) ValidateKey(c fiber.Ctx) error {
	var req dtos.ValidateKey
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	result, err := h.probe(c.Context(), req.Provider, encodeMetadata(req.Metadata), req.APIKey, false)
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

	account, err := h.app.Repos.Accounts.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, accountView(account))
}

// Update mutates an account. Empty credential fields keep the stored sealed
// blobs; providing new material re-seals and re-fingerprints.
func (h *accountsHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.Account
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	account, err := h.app.Repos.Accounts.Get(c.Context(), id.String())
	if err != nil {
		return err
	}

	in := accountInputFrom(req)
	if in.Label != "" {
		account.Label = in.Label
	}
	// Branch on the raw request: accountInputFrom applies the "api_key"
	// default for creates, so in.AuthKind is never empty and would otherwise
	// overwrite an oauth/none account on every update.
	if req.AuthKind != "" {
		account.AuthKind = models.AuthKind(req.AuthKind)
	}
	if in.Metadata != "" {
		account.Metadata = in.Metadata
	}
	if in.Priority != 0 {
		account.Priority = in.Priority
	}
	if in.ProxyPoolID != "" {
		poolID := in.ProxyPoolID
		account.ProxyPoolID = &poolID
	}
	if req.Disabled != nil {
		account.Disabled = *req.Disabled
	}
	if in.APIKey != "" || in.Token != "" || in.Refresh != "" {
		if err := sealCredential(h.app, &account, in); err != nil {
			return err
		}
	}

	if err := h.app.Repos.Accounts.Update(c.Context(), account); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.update", id.String(), nil)
	return dtos.OK(c, accountView(account))
}

func (h *accountsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Repos.Accounts.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.delete", id.String(), nil)
	return dtos.Deleted(c, "Account deleted")
}

// Test probes the stored credential against the upstream.
func (h *accountsHandler) Test(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	account, err := h.app.Repos.Accounts.Get(c.Context(), id.String())
	if err != nil {
		return err
	}

	// OAuth accounts carry the credential in Token, not Secret; probe
	// whichever one is populated so the test reflects the stored auth kind.
	apiKey := ""
	oauth := false
	if !account.Secret.Empty() {
		apiKey, err = h.app.Secrets.OpenString(account.Secret)
		if err != nil {
			return err
		}
	}
	if apiKey == "" && !account.Token.Empty() {
		apiKey, err = h.app.Secrets.OpenString(account.Token)
		if err != nil {
			return err
		}
		oauth = true
	}
	result, err := h.probe(c.Context(), account.Provider, account.Metadata, apiKey, oauth)
	if err != nil {
		return err
	}
	return dtos.OK(c, result)
}

// probe resolves the endpoint from the provider catalog (overridable via
// account metadata) and asks the upstream service to verify the credential.
// Providers with a dedicated integration flow (ported from IDRouter's
// connectors) use their own probe: OpenRouter validates against /api/v1/key,
// the Ollama family against /api/tags, and Cline skips validation entirely.
func (h *accountsHandler) probe(ctx context.Context, providerSlug, metadataRaw, apiKey string, oauth bool) (dtos.TestResult, error) {
	spec, ok := catalog.Lookup(providerSlug)
	if !ok {
		return dtos.TestResult{OK: true, Detail: "no probe available for provider"}, nil
	}

	baseURL := spec.BaseURL
	var metadata map[string]any
	if err := json.Unmarshal([]byte(orEmptyJSON(metadataRaw)), &metadata); err == nil {
		if u, ok := metadata["base_url"].(string); ok && u != "" {
			baseURL = u
		}
	}
	if baseURL == "" {
		return dtos.TestResult{OK: true, Detail: "no base_url configured; skipped upstream probe"}, nil
	}

	switch providerSlug {
	case "openrouter":
		if apiKey == "" {
			return dtos.TestResult{OK: true, Detail: "no credential stored; skipped upstream probe"}, nil
		}
		return h.app.Services.Upstream.ProbeOpenRouterKey(ctx, baseURL, apiKey)
	case "ollama", "ollama-local":
		// /api/tags doubles as the Ollama probe and model list; it needs no
		// auth locally and accepts the cloud key via bearer.
		models, err := h.app.Services.Upstream.ListOllamaModels(ctx, baseURL, apiKey)
		if err != nil {
			return dtos.TestResult{OK: false, Detail: err.Error()}, nil
		}
		detail := "credential accepted"
		if apiKey == "" {
			detail = "daemon reachable"
		}
		return dtos.TestResult{OK: true, Detail: fmt.Sprintf("%s · %d models", detail, len(models))}, nil
	case "cline":
		// IDRouter marks Cline SkipValidation: its gateway answers /models 404
		// and the recommended-models endpoint is public, so there is no cheap
		// authenticated probe.
		return dtos.TestResult{OK: true, Detail: "provider skips credential validation"}, nil
	}

	if spec.AuthKind == string(models.AuthNone) {
		return dtos.TestResult{OK: true, Detail: "provider requires no authentication"}, nil
	}

	anthropic := spec.Dialect == "anthropic"
	endpoint := services.V1Join(baseURL, "models")
	return h.app.Services.Upstream.ProbeCredential(ctx, endpoint, anthropic, oauth, apiKey)
}

// Reveal decrypts the stored api key of an account (audit-logged).
func (h *accountsHandler) Reveal(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	account, err := h.app.Repos.Accounts.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	if account.Secret.Empty() {
		return apperr.New(apperr.KindUnprocessable, "account has no recoverable secret")
	}

	plaintext, err := h.app.Secrets.OpenString(account.Secret)
	if err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.reveal", id.String(), nil)
	return dtos.OK(c, fiber.Map{"id": id.String(), "api_key": plaintext})
}

// AccountQuota reports the account's usage-based quota snapshot. Upstream
// quota probing arrives with the gateway phase; until then visibility is
// usage-only.
func (h *accountsHandler) Quota(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if _, err := h.app.Repos.Accounts.Get(c.Context(), id.String()); err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"account_id":       id.String(),
		"quota_visibility": "usage-only",
		"quota_note":       "Provider does not expose upstream limits.",
	})
}

// QuotaReset clears in-memory rate/quota strikes for the account.
func (h *accountsHandler) QuotaReset(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if _, err := h.app.Repos.Accounts.Get(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.quota_reset", id.String(), nil)
	return dtos.Message(c, fiber.StatusOK, "Quota state reset")
}

// orEmptyJSON normalizes an empty metadata payload to an empty JSON object.
func orEmptyJSON(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return "{}"
	}
	return raw
}
