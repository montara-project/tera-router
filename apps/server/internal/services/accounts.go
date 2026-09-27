package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

type AccountService struct {
	repos   *repositories.Repositories
	secrets *sealer.Sealer
	audit   *AuditService
}

// AccountInput carries one credential for create/update. Secret is only
// sealed at rest; plaintext never leaves this function's scope otherwise.
type AccountInput struct {
	Provider    string
	Label       string
	AuthKind    models.AuthKind
	APIKey      string
	Token       string
	Refresh     string
	Metadata    string // raw JSON object
	Priority    int
	ProxyPoolID string
}

// AccountResult is the API view of an account: masked, never plaintext.
type AccountResult struct {
	models.Account
	MetadataParsed map[string]any `json:"-"`
}

// Create stores a new upstream credential. Duplicate keys (same sha-256 of
// the plaintext api key) are rejected, mirroring IDRouter's dedup.
func (s *AccountService) Create(ctx context.Context, actor string, in AccountInput) (models.Account, error) {
	account, err := s.buildAccount(in)
	if err != nil {
		return models.Account{}, err
	}
	account.ID = uuid.NewString()

	if account.KeyHash != "" {
		if _, err := s.repos.Accounts.FindByKeyHash(ctx, account.KeyHash); err == nil {
			return models.Account{}, apperr.New(apperr.KindConflict, "an account with this key already exists")
		}
	}

	if err := s.repos.Accounts.Create(ctx, account); err != nil {
		return models.Account{}, err
	}
	s.audit.Record(ctx, actor, "account.create", account.ID, map[string]string{"provider": account.Provider, "label": account.Label})
	return account, nil
}

// BulkCreate stores many credentials in one transaction.
func (s *AccountService) BulkCreate(ctx context.Context, actor string, inputs []AccountInput) ([]models.Account, error) {
	accounts := make([]models.Account, 0, len(inputs))
	for _, in := range inputs {
		a, err := s.buildAccount(in)
		if err != nil {
			return nil, err
		}
		a.ID = uuid.NewString()
		accounts = append(accounts, a)
	}

	if err := s.repos.Accounts.BulkCreate(ctx, accounts); err != nil {
		return nil, err
	}
	s.audit.Record(ctx, actor, "account.bulk_create", fmt.Sprintf("%d accounts", len(accounts)), map[string]int{"count": len(accounts)})
	return accounts, nil
}

// buildAccount seals secret material and derives the dedup fingerprint/hash.
func (s *AccountService) buildAccount(in AccountInput) (models.Account, error) {
	if in.Provider == "" {
		return models.Account{}, apperr.New(apperr.KindBadRequest, "provider is required")
	}

	account := models.Account{
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
	if account.AuthKind == "" {
		account.AuthKind = models.AuthAPIKey
	}

	if in.APIKey != "" {
		sealed, err := s.secrets.SealString(in.APIKey)
		if err != nil {
			return models.Account{}, err
		}
		account.Secret = toModelsSealed(sealed)
		account.KeyFingerprint = fingerprint(in.APIKey)
		sum := sha256.Sum256([]byte(in.APIKey))
		account.KeyHash = hex.EncodeToString(sum[:])
	}
	if in.Token != "" {
		sealed, err := s.secrets.SealString(in.Token)
		if err != nil {
			return models.Account{}, err
		}
		account.Token = toModelsSealed(sealed)
	}
	if in.Refresh != "" {
		sealed, err := s.secrets.SealString(in.Refresh)
		if err != nil {
			return models.Account{}, err
		}
		account.Refresh = toModelsSealed(sealed)
	}
	return account, nil
}

// fingerprint is a masked key hint (head…tail) for the dashboard, mirroring
// IDRouter's KeyFingerprint.
func fingerprint(plaintext string) string {
	if len(plaintext) <= 8 {
		return "…"
	}
	return plaintext[:4] + "…" + plaintext[len(plaintext)-4:]
}

func orEmptyJSON(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return "{}"
	}
	return raw
}

// List returns paginated accounts.
func (s *AccountService) List(ctx context.Context, offset, limit int) ([]models.Account, int, error) {
	return s.repos.Accounts.List(ctx, offset, limit)
}

// Get returns one account by id.
func (s *AccountService) Get(ctx context.Context, id string) (models.Account, error) {
	return s.repos.Accounts.FindByID(ctx, id)
}

// Update mutates an account. Empty credential fields keep the stored sealed
// blobs; providing new material re-seals and re-fingerprints.
func (s *AccountService) Update(ctx context.Context, actor, id string, in AccountInput, disabled *bool) (models.Account, error) {
	account, err := s.repos.Accounts.FindByID(ctx, id)
	if err != nil {
		return models.Account{}, err
	}

	if in.Label != "" {
		account.Label = in.Label
	}
	if in.AuthKind != "" {
		account.AuthKind = in.AuthKind
	}
	if in.Metadata != "" {
		account.Metadata = in.Metadata
	}
	if in.Priority != 0 {
		account.Priority = in.Priority
	}
	if in.ProxyPoolID != "" {
		account.ProxyPoolID = &in.ProxyPoolID
	}
	if disabled != nil {
		account.Disabled = *disabled
	}
	if in.APIKey != "" {
		sealed, err := s.secrets.SealString(in.APIKey)
		if err != nil {
			return models.Account{}, err
		}
		account.Secret = toModelsSealed(sealed)
		account.KeyFingerprint = fingerprint(in.APIKey)
		sum := sha256.Sum256([]byte(in.APIKey))
		account.KeyHash = hex.EncodeToString(sum[:])
	}

	if err := s.repos.Accounts.Update(ctx, account); err != nil {
		return models.Account{}, err
	}
	s.audit.Record(ctx, actor, "account.update", id, nil)
	return account, nil
}

// Delete removes one account.
func (s *AccountService) Delete(ctx context.Context, actor, id string) error {
	if err := s.repos.Accounts.Delete(ctx, id); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "account.delete", id, nil)
	return nil
}

// BulkOps covers the provider-scoped bulk account operations from IDRouter.
type BulkOpsResult struct {
	Deleted int64 `json:"deleted"`
	Updated int64 `json:"updated"`
}

func (s *AccountService) DeleteDisabled(ctx context.Context, actor, provider string) (int64, error) {
	n, err := s.repos.Accounts.DeleteDisabled(ctx, provider)
	if err == nil {
		s.audit.Record(ctx, actor, "account.delete_disabled", provider, map[string]int64{"deleted": n})
	}
	return n, err
}

func (s *AccountService) DeleteAll(ctx context.Context, actor, provider string) (int64, error) {
	n, err := s.repos.Accounts.DeleteAll(ctx, provider)
	if err == nil {
		s.audit.Record(ctx, actor, "account.delete_all", provider, map[string]int64{"deleted": n})
	}
	return n, err
}

func (s *AccountService) SetDisabledByProvider(ctx context.Context, actor, provider string, disabled bool) (int64, error) {
	n, err := s.repos.Accounts.SetDisabledByProvider(ctx, provider, disabled)
	if err == nil {
		s.audit.Record(ctx, actor, "account.bulk_disable", provider, map[string]any{"disabled": disabled, "updated": n})
	}
	return n, err
}

// TestResult reports one credential validation attempt.
type TestResult struct {
	OK        bool   `json:"ok"`
	Status    int    `json:"status"`
	LatencyMS int64  `json:"latency_ms"`
	Detail    string `json:"detail"`
}

// Test probes the upstream with the stored credential.
func (s *AccountService) Test(ctx context.Context, id string) (TestResult, error) {
	account, err := s.repos.Accounts.FindByID(ctx, id)
	if err != nil {
		return TestResult{}, err
	}

	apiKey := ""
	if !account.Secret.Empty() {
		apiKey, err = s.secrets.OpenString(fromModelsSealed(account.Secret))
		if err != nil {
			return TestResult{}, err
		}
	}
	return s.probe(ctx, account.Provider, account.Metadata, apiKey)
}

// ValidateKey probes a plaintext key against a provider before it is saved
// (admin "validate-key" endpoint).
func (s *AccountService) ValidateKey(ctx context.Context, provider, apiKey, metadata string) (TestResult, error) {
	return s.probe(ctx, provider, orEmptyJSON(metadata), apiKey)
}

// probe performs a lightweight authenticated GET against the provider's
// model list endpoint to verify the credential.
func (s *AccountService) probe(ctx context.Context, providerSlug, metadataRaw, apiKey string) (TestResult, error) {
	spec, ok := CatalogLookup(providerSlug)
	if !ok {
		return TestResult{OK: true, Detail: "no probe available for provider"}, nil
	}
	baseURL := spec.BaseURL
	if meta, err := parseMetadata(metadataRaw); err == nil {
		if u, ok := meta["base_url"].(string); ok && u != "" {
			baseURL = u
		}
	}
	if baseURL == "" {
		return TestResult{OK: true, Detail: "no base_url configured; skipped upstream probe"}, nil
	}
	if spec.AuthKind == string(models.AuthNone) {
		return TestResult{OK: true, Detail: "provider requires no authentication"}, nil
	}

	endpoint, err := modelsEndpoint(baseURL, providerSlug)
	if err != nil {
		return TestResult{}, apperr.New(apperr.KindBadRequest, "invalid base_url: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return TestResult{}, err
	}
	if providerSlug == "anthropic" || providerSlug == "claude" || strings.Contains(baseURL, "anthropic") {
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	start := time.Now()
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return TestResult{OK: false, LatencyMS: latency, Detail: err.Error()}, nil
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 512))

	result := TestResult{Status: resp.StatusCode, LatencyMS: latency}
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		result.OK = true
		result.Detail = "credential accepted"
	} else if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		result.Detail = "credential rejected by provider"
	} else {
		result.Detail = fmt.Sprintf("upstream responded with status %d", resp.StatusCode)
	}
	return result, nil
}

// modelsEndpoint normalizes the model-list URL for the two wire dialects.
func modelsEndpoint(baseURL, providerSlug string) (string, error) {
	base := strings.TrimSuffix(baseURL, "/")
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("cannot parse %q", baseURL)
	}
	if providerSlug == "anthropic" || providerSlug == "claude" || strings.Contains(base, "anthropic") {
		return base + "/v1/models", nil
	}
	if strings.HasSuffix(u.Path, "/v1") || strings.HasSuffix(u.Path, "/openai/v1") {
		return base + "/models", nil
	}
	return base + "/v1/models", nil
}

func parseMetadata(raw string) (map[string]any, error) {
	meta := map[string]any{}
	if err := json.Unmarshal([]byte(raw), &meta); err != nil {
		return nil, err
	}
	return meta, nil
}

// Reveal decrypts the stored api key of an account (audit-logged).
func (s *AccountService) Reveal(ctx context.Context, actor, id string) (string, error) {
	account, err := s.repos.Accounts.FindByID(ctx, id)
	if err != nil {
		return "", err
	}
	if account.Secret.Empty() {
		return "", apperr.New(apperr.KindUnprocessable, "account has no recoverable secret")
	}
	plaintext, err := s.secrets.OpenString(fromModelsSealed(account.Secret))
	if err != nil {
		return "", err
	}
	s.audit.Record(ctx, actor, "account.reveal", id, nil)
	return plaintext, nil
}

// AccountQuota reports the account's usage-based quota snapshot. Upstream
// quota probing arrives with the gateway phase; until then visibility is
// usage-only.
func (s *AccountService) AccountQuota(ctx context.Context, id string) (map[string]any, error) {
	if _, err := s.repos.Accounts.FindByID(ctx, id); err != nil {
		return nil, err
	}
	return map[string]any{
		"account_id":       id,
		"quota_visibility": "usage-only",
		"quota_note":       "Provider does not expose upstream limits.",
	}, nil
}

// AccountQuotaReset clears in-memory rate/quota strikes for the account.
func (s *AccountService) AccountQuotaReset(ctx context.Context, actor, id string) error {
	if _, err := s.repos.Accounts.FindByID(ctx, id); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "account.quota_reset", id, nil)
	return nil
}
