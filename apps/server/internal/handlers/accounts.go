package handlers

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/catalog"
	"tera-router/server/internal/connectors"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
	"tera-router/server/internal/oauth"
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
	in := accountInput{
		Provider: d.Provider,
		AuthKind: models.AuthKind(cmp.Or(d.AuthKind, "api_key")),
		APIKey:   d.APIKey,
		Token:    d.Token,
		Refresh:  d.Refresh,
		Metadata: encodeMetadata(d.Metadata),
	}
	if d.Label != nil {
		in.Label = *d.Label
	}
	if d.Priority != nil {
		in.Priority = *d.Priority
	}
	if d.ProxyPoolID != nil {
		in.ProxyPoolID = *d.ProxyPoolID
	}
	return in
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

// metadataBaseURL reads the account-level endpoint override from raw
// metadata JSON, "" when unset.
func metadataBaseURL(raw string) string {
	var meta struct {
		BaseURL string `json:"base_url"`
	}
	_ = json.Unmarshal([]byte(raw), &meta)
	return strings.TrimSpace(meta.BaseURL)
}

// seal seals one credential into the account's envelope blobs and derives
// the dedup fingerprint/hash.
func sealCredential(a *app.Application, account *models.Account, in accountInput) error {
	if in.APIKey != "" {
		sealed, err := a.Secrets.SealString(in.APIKey, sealer.PurposeAccountSecret)
		if err != nil {
			return err
		}
		account.Secret = sealed
		account.KeyFingerprint = fingerprint(in.APIKey)
		sum := sha256.Sum256([]byte(in.APIKey))
		account.KeyHash = hex.EncodeToString(sum[:])
	}
	if in.Token != "" {
		sealed, err := a.Secrets.SealString(in.Token, sealer.PurposeAccountToken)
		if err != nil {
			return err
		}
		account.Token = sealed
	}
	if in.Refresh != "" {
		sealed, err := a.Secrets.SealString(in.Refresh, sealer.PurposeAccountRefresh)
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

// maxAccountListLimit is the largest page of accounts one request returns.
// The dashboard filters accounts per provider in the browser, so it reads
// them whole; at the default ceiling of 100 a provider with more accounts
// showed only some of them.
const maxAccountListLimit = 1000

func (h *accountsHandler) Index(c fiber.Ctx) error {
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.ClampTo(maxAccountListLimit)

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

	account, err := h.create(c.Context(), actorFrom(c), in)
	if err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "account.create", account.ID, map[string]string{"provider": account.Provider, "label": account.Label})
	return dtos.Created(c, accountView(account), "Account created")
}

// create seals and inserts one account, answering a conflict when its API
// key is already stored. Store and BulkStore share it.
func (h *accountsHandler) create(ctx context.Context, actor string, in accountInput) (models.Account, error) {
	// A connect on a seedable catalog provider persists its custom_providers
	// row so the dashboard can address it by uuid (provider detail page).
	if _, err := ensureCustomProviderRow(ctx, h.app, actor, in.Provider); err != nil {
		return models.Account{}, err
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
		return models.Account{}, err
	}

	if account.KeyHash != "" {
		// Only a genuine miss means "no duplicate"; any other error is a real
		// failure and must not be mistaken for a free slot.
		if _, err := h.app.Repos.Accounts.GetByKeyHash(ctx, account.KeyHash); err == nil {
			return models.Account{}, apperr.New(apperr.KindConflict, "an account with this key already exists")
		} else if !errors.Is(err, apperr.ErrNotFound) {
			return models.Account{}, err
		}
	}

	if err := h.app.Repos.Accounts.Insert(ctx, account); err != nil {
		return models.Account{}, err
	}
	return account, nil
}

// maxBulkKeys bounds one bulk add: each key is sealed and inserted on its own.
const maxBulkKeys = 1000

// BulkStore adds one API-key account per pasted key
// (POST /v1/accounts/bulk). Keys are handled one by one, so a bad or
// duplicate key never blocks the rest: duplicates (already stored, or
// repeated in the paste) land in skipped, other failures in failed.
func (h *accountsHandler) BulkStore(c fiber.Ctx) error {
	var req dtos.AccountBulk
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	keys := make([]string, 0, len(req.APIKeys))
	for _, k := range req.APIKeys {
		if k = strings.TrimSpace(k); k != "" {
			keys = append(keys, k)
		}
	}
	if len(keys) == 0 {
		return apperr.New(apperr.KindBadRequest, "at least one api key is required")
	}
	if len(keys) > maxBulkKeys {
		return apperr.New(apperr.KindBadRequest, "at most %d api keys per request", maxBulkKeys)
	}

	prefix := cmp.Or(strings.TrimSpace(req.LabelPrefix), "key")
	metadata := encodeMetadata(req.Metadata)
	actor := actorFrom(c)

	created := make([]fiber.Map, 0, len(keys))
	skipped := []fiber.Map{}
	failed := []fiber.Map{}
	for i, key := range keys {
		account, err := h.create(c.Context(), actor, accountInput{
			Provider:    req.Provider,
			Label:       fmt.Sprintf("%s %d", prefix, i+1),
			AuthKind:    models.AuthAPIKey,
			APIKey:      key,
			Metadata:    metadata,
			Priority:    cmp.Or(req.Priority, 100),
			ProxyPoolID: req.ProxyPoolID,
		})
		if err == nil {
			created = append(created, accountView(account))
			continue
		}
		// From keeps a typed error's message and reduces anything else to a
		// generic one, so internals never reach the response.
		status, message := apperr.From(err)
		if status == fiber.StatusConflict {
			skipped = append(skipped, fiber.Map{"index": i, "key_fingerprint": fingerprint(key)})
			continue
		}
		// The error is reported per key instead of returned, so this log is
		// the only place its detail survives.
		slog.Warn("bulk account create failed", "provider", req.Provider, "index", i, "error", err)
		failed = append(failed, fiber.Map{"index": i, "key_fingerprint": fingerprint(key), "error": message})
	}
	if len(created) > 0 {
		auditRecord(c, actor, "account.bulk_create", req.Provider, map[string]int{"created": len(created), "skipped": len(skipped), "failed": len(failed)})
	}
	return dtos.OK(c, fiber.Map{"created": created, "skipped": skipped, "failed": failed})
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
	// The next test or dispatch sends the stored credential to base_url, so
	// pointing it somewhere new needs the same re-authentication as a reveal.
	if u := metadataBaseURL(in.Metadata); u != "" && u != metadataBaseURL(account.Metadata) {
		needsCode, err := reauthenticate(c, h.app, req.Password, req.OTP, req.ReauthTicket)
		if err != nil {
			return err
		}
		if needsCode {
			return totpRequired(c)
		}
	}
	// Branch on the raw request's pointer fields: nil keeps the stored value
	// while a present value — including zero/empty — is applied, so a PATCH
	// can zero the priority, empty the label, or detach the proxy pool.
	if req.Label != nil {
		account.Label = *req.Label
	}
	// accountInputFrom applies the "api_key" default for creates, so
	// in.AuthKind is never empty and would overwrite an oauth/none account on
	// every update.
	if req.AuthKind != "" {
		account.AuthKind = models.AuthKind(req.AuthKind)
	}
	if req.Metadata != nil {
		account.Metadata = encodeMetadata(req.Metadata)
	}
	if req.Priority != nil {
		account.Priority = *req.Priority
	}
	if req.ProxyPoolID != nil {
		if *req.ProxyPoolID == "" {
			account.ProxyPoolID = nil
		} else {
			poolID := *req.ProxyPoolID
			account.ProxyPoolID = &poolID
		}
	}
	if req.Disabled != nil {
		account.Disabled = *req.Disabled
	}
	// Scoped writes keep a racing OAuth refresh safe in both directions: a
	// credential-carrying PATCH deliberately re-seals the whole row, while a
	// profile-only PATCH must not overwrite token blobs sealed mid-request.
	update := h.app.Repos.Accounts.UpdateProfile
	if in.APIKey != "" || in.Token != "" || in.Refresh != "" {
		if err := sealCredential(h.app, &account, in); err != nil {
			return err
		}
		update = h.app.Repos.Accounts.Update
	}
	if err := update(c.Context(), account); err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "account.update", id.String(), nil)
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
	auditRecord(c, actorFrom(c), "account.delete", id.String(), nil)
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

	// An OAuth account's access token expires, so refresh it before probing:
	// a stale token reports a healthy account as a rejected credential.
	if account.AuthKind == models.AuthOAuth {
		if account, err = h.app.OAuth.EnsureFresh(c.Context(), account); err != nil {
			return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
		}
	}
	// OAuth accounts carry the credential in Token, not Secret; probe
	// whichever one is populated so the test reflects the stored auth kind.
	apiKey := ""
	oauth := false
	if !account.Secret.Empty() {
		apiKey, err = h.app.Secrets.OpenString(account.Secret, sealer.PurposeAccountSecret)
		if err != nil {
			return err
		}
	}
	if apiKey == "" && !account.Token.Empty() {
		apiKey, err = h.app.Secrets.OpenString(account.Token, sealer.PurposeAccountToken)
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

// TestKey checks a credential against its provider before it is saved
// (POST /v1/accounts/test). Nothing is stored; the probe is the same one Test
// runs for a saved account.
func (h *accountsHandler) TestKey(c fiber.Ctx) error {
	var req dtos.Account
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	in := accountInputFrom(req)
	apiKey := strings.TrimSpace(in.APIKey)
	if in.Provider == "" || apiKey == "" {
		return apperr.New(apperr.KindBadRequest, "provider and api_key are required")
	}
	result, err := h.probe(c.Context(), in.Provider, in.Metadata, apiKey, false)
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
		// Custom providers live in custom_providers; probe their /models with
		// the dialect their api_kind speaks.
		custom, err := h.app.Repos.Providers.GetBySlug(ctx, providerSlug)
		if err != nil {
			return dtos.TestResult{OK: true, Detail: "no probe available for provider"}, nil
		}
		dialect := "openai"
		if custom.APIKind == "anthropic" {
			dialect = "anthropic"
		}
		spec = dtos.CatalogProvider{
			Slug:         custom.Slug,
			Capabilities: []string{"chat"},
			BaseURL:      custom.BaseURL,
			Dialect:      dialect,
			AuthKind:     string(models.AuthAPIKey),
		}
	}

	if !slices.Contains(spec.Capabilities, "chat") {
		// Web search providers have no free authenticated endpoint; every
		// call is billed, so the key is checked on first use instead.
		return dtos.TestResult{OK: true, Detail: "provider skips credential validation"}, nil
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
	case "cline", "clinepayg", "clinepass":
		// IDRouter marks Cline SkipValidation: its gateway answers /models 404
		// and the recommended-models endpoint is public, so there is no cheap
		// authenticated probe.
		return dtos.TestResult{OK: true, Detail: "provider skips credential validation"}, nil
	case "workbuddy", "codebuddy", "codebuddy-cn":
		// No /models endpoint: the CLI config is the authenticated model list,
		// and reading it costs no credits — unlike a chat probe.
		if apiKey == "" {
			return dtos.TestResult{OK: true, Detail: "no credential stored; skipped upstream probe"}, nil
		}
		start := time.Now()
		models, err := h.app.Services.Upstream.ListBuddyModels(ctx, baseURL, apiKey, providerSlug)
		latency := time.Since(start).Milliseconds()
		if err != nil {
			return dtos.TestResult{OK: false, LatencyMS: latency, Detail: err.Error()}, nil
		}
		return dtos.TestResult{OK: true, LatencyMS: latency, Detail: fmt.Sprintf("credential accepted · %d models", len(models))}, nil
	}

	if spec.AuthKind == string(models.AuthNone) {
		return dtos.TestResult{OK: true, Detail: "provider requires no authentication"}, nil
	}

	anthropic := spec.Dialect == "anthropic"
	endpoint := services.V1Join(baseURL, "models")
	return h.app.Services.Upstream.ProbeCredential(ctx, endpoint, anthropic, oauth, apiKey)
}

// Quota reports an account's quota snapshot. Claude subscription (anthropic
// OAuth) accounts read their live session (5-hour) and weekly windows from
// Anthropic; ZCode Plan (zcode OAuth) accounts read their plan grants from
// the zcode.z.ai billing endpoints; Cline and Cline PAYG accounts read their
// credit balance; every other account is usage-only.
func (h *accountsHandler) Quota(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	account, err := h.app.Repos.Accounts.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	if clineQuotaProvider(account.Provider) {
		return h.clineQuota(c, account)
	}
	if connectors.IsBuddy(account.Provider) {
		return h.buddyQuota(c, account)
	}
	if account.Provider != "anthropic" && account.Provider != "zcode" {
		return dtos.OK(c, fiber.Map{
			"account_id":       id.String(),
			"quota_visibility": "usage-only",
			"quota_note":       "Provider does not expose upstream limits.",
			"windows":          []oauth.UsageWindow{},
		})
	}
	if account.AuthKind != models.AuthOAuth {
		return dtos.OK(c, fiber.Map{
			"account_id":       id.String(),
			"quota_visibility": "usage-only",
			"quota_note":       "Upstream limits are only reported for OAuth accounts.",
			"windows":          []oauth.UsageWindow{},
		})
	}

	account, err = h.app.OAuth.EnsureFresh(c.Context(), account)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	token, err := h.app.Secrets.OpenString(account.Token, sealer.PurposeAccountToken)
	if err != nil {
		return err
	}

	if account.Provider == "zcode" {
		quota, qerr := oauth.FetchZcodePlanQuota(c.Context(), token, oauth.ZcodeDeviceMid(account.ID))
		if qerr != nil {
			return apperr.New(apperr.KindUnprocessable, "%s", qerr.Error())
		}
		return dtos.OK(c, fiber.Map{
			"account_id":       id.String(),
			"quota_visibility": "upstream",
			"quota_note":       "ZCode Plan grants reported by zcode.z.ai.",
			"source":           quota.Source,
			"server_time":      quota.ServerTime,
			"rows":             quota.Rows,
			"errors":           quota.Errors,
			"fetched_at":       time.Now().UTC(),
		})
	}

	windows, err := oauth.FetchClaudeUsage(c.Context(), token)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	return dtos.OK(c, fiber.Map{
		"account_id":       id.String(),
		"quota_visibility": "upstream",
		"quota_note":       "Claude subscription limits reported by Anthropic.",
		"windows":          windows,
		"fetched_at":       time.Now().UTC(),
	})
}

// orEmptyJSON normalizes an empty metadata payload to an empty JSON object.
func orEmptyJSON(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return "{}"
	}
	return raw
}
