package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/catalog"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
	"tera-router/server/internal/oauth"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// oauthHandler drives the OAuth connection flows for subscription providers
// (claude, codex), ported from the IDRouter reference. Starting a flow and
// persisting tokens are privileged operations, so every route sits behind the
// dashboard's JWT auth.
type oauthHandler struct {
	app *app.Application

	sessions *oauth.SessionStore

	// loopbackMu guards the fixed-port callback listeners (codex binds
	// localhost:1455, falling back to 1457). Listeners live for the process
	// lifetime once bound.
	loopbackMu   sync.Mutex
	loopbackPort int
}

// oauthProviderInfo is one entry of GET /v1/oauth/providers.
type oauthProviderInfo struct {
	Provider     string `json:"provider"`
	Flow         string `json:"flow"`
	CallbackPath string `json:"callback_path,omitempty"`
	FixedPort    int    `json:"fixed_port,omitempty"`
	LoopbackHost string `json:"loopback_host,omitempty"`
}

// ListProviders reports which catalog providers support an OAuth flow, so the
// dashboard can render the OAuth connect UI.
func (h *oauthHandler) ListProviders(c fiber.Ctx) error {
	out := make([]oauthProviderInfo, 0, len(oauth.SupportedProviders()))
	for _, id := range oauth.SupportedProviders() {
		cfg, _ := oauth.ConfigFor(id)
		out = append(out, oauthProviderInfo{
			Provider:     id,
			Flow:         string(cfg.Flow),
			CallbackPath: cfg.CallbackPath,
			FixedPort:    cfg.FixedLoopbackPort,
			LoopbackHost: cfg.LoopbackHost,
		})
	}
	return dtos.List(c, out, dtos.TotalMeta(len(out)))
}

// Authorize starts an authorization-code + PKCE flow. It returns the provider
// authorize URL the dashboard should open, and stores the PKCE verifier +
// state server-side keyed by state.
func (h *oauthHandler) Authorize(c fiber.Ctx) error {
	provider := c.Params("provider")
	cfg, ok := oauth.ConfigFor(provider)
	if !ok {
		return apperr.New(apperr.KindBadRequest, "no OAuth config for provider: %s", provider)
	}

	var req dtos.OAuthAuthorize
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	if req.RedirectURI == "" {
		return apperr.New(apperr.KindBadRequest, "redirect_uri is required")
	}

	// Fixed-port providers must advertise the port this server actually owns,
	// so bind before resolving: Codex's OAuth app also allow-lists 1457,
	// letting a busy 1455 fall back instead of failing the flow.
	boundPort, err := h.ensureLoopback(cfg)
	if err != nil {
		return apperr.New(apperr.KindConflict, "%s", err.Error())
	}
	redirectURI := cfg.ResolveRedirectURI(req.RedirectURI, boundPort)

	// The callback target is opened in the user's browser; restrict it to
	// loopback origins or https so the flow cannot be pointed at an arbitrary
	// third-party host.
	if err := validateOAuthRedirect(redirectURI); err != nil {
		return apperr.New(apperr.KindBadRequest, "invalid redirect_uri: %s", err.Error())
	}

	pkce, err := oauth.GeneratePKCE(32)
	if err != nil {
		return err
	}
	authURL := cfg.AuthURL(redirectURI, pkce.State, pkce.Challenge)

	h.sessions.Put(pkce.State, &oauth.Session{
		Provider:    provider,
		Flow:        cfg.Flow,
		State:       pkce.State,
		Verifier:    pkce.Verifier,
		RedirectURI: redirectURI,
	})

	return dtos.OK(c, fiber.Map{
		"authorize_url": authURL,
		"state":         pkce.State,
		"redirect_uri":  redirectURI,
	})
}

// Exchange completes an authorization-code flow: it exchanges the (pasted or
// redirected) code for tokens and persists them as an OAuth account.
func (h *oauthHandler) Exchange(c fiber.Ctx) error {
	provider := c.Params("provider")
	cfg, ok := oauth.ConfigFor(provider)
	if !ok {
		return apperr.New(apperr.KindBadRequest, "no OAuth config for provider: %s", provider)
	}

	var req dtos.OAuthExchange
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	if req.Code == "" || req.State == "" {
		return apperr.New(apperr.KindBadRequest, "code and state are required")
	}

	sess, ok := h.sessions.Get(req.State)
	if !ok || sess.Provider != provider {
		return apperr.New(apperr.KindBadRequest, "OAuth session not found or expired; restart the flow")
	}
	tokens, err := cfg.ExchangeCode(c.Context(), req.Code, sess.RedirectURI, sess.Verifier, req.State)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	h.sessions.Delete(req.State)

	id, email, perr := h.persistAccount(c.Context(), actorFrom(c), provider, req.Label, tokens)
	if perr != nil {
		return perr
	}
	return dtos.Created(c, fiber.Map{"id": id, "provider": provider, "email": email}, "OAuth account connected")
}

// persistAccount seals OAuth tokens into an account record, deduplicating on
// the account identity (metadata email first, then the refresh-token
// plaintext): reconnecting the same grant updates the existing row in place
// instead of creating a duplicate.
func (h *oauthHandler) persistAccount(ctx context.Context, actor, provider, label string, tokens *oauth.Tokens) (string, string, error) {
	now := time.Now()

	acc := models.Account{
		ID:        uuid.NewString(),
		Provider:  provider,
		Label:     oauthLabel(label, provider, tokens),
		AuthKind:  models.AuthOAuth,
		Priority:  100,
		CreatedAt: now,
		UpdatedAt: now,
	}

	var expiresAt *time.Time
	if tokens.ExpiresIn > 0 {
		t := now.Add(time.Duration(tokens.ExpiresIn) * time.Second)
		expiresAt = &t
	}

	meta := map[string]string{}
	for k, v := range tokens.Extra {
		meta[k] = v
	}
	if tokens.Email != "" {
		meta["email"] = tokens.Email
	}
	// The catalog's upstream endpoint never reaches the gateway credentials
	// through the standard account fields; inject it so probes and routing
	// hit the right base URL.
	if spec, ok := catalog.Lookup(provider); ok && spec.BaseURL != "" {
		meta["base_url"] = spec.BaseURL
	}
	rawMeta, merr := json.Marshal(meta)
	if merr != nil {
		return "", "", apperr.New(apperr.KindInternal, "encode account metadata: %s", merr.Error())
	}
	acc.Metadata = string(rawMeta)
	acc.TokenExpiresAt = expiresAt

	sealedAccess, serr := h.app.Secrets.SealString(tokens.AccessToken)
	if serr != nil {
		return "", "", apperr.New(apperr.KindInternal, "seal access token: %s", serr.Error())
	}
	acc.Token = toModelsSealed(sealedAccess)
	if tokens.RefreshToken != "" {
		sealedRefresh, serr := h.app.Secrets.SealString(tokens.RefreshToken)
		if serr != nil {
			return "", "", apperr.New(apperr.KindInternal, "seal refresh token: %s", serr.Error())
		}
		acc.Refresh = toModelsSealed(sealedRefresh)
	}

	// Dedup: metadata email first, then the refresh-token plaintext (same
	// grant = same account, even when the profile fetch failed).
	existing, derr := h.findExistingOAuthAccount(ctx, provider, meta, tokens.RefreshToken)
	if derr != nil {
		return "", "", derr
	}
	if existing != nil {
		existing.Label = acc.Label
		existing.Token = acc.Token
		existing.Refresh = acc.Refresh
		existing.TokenExpiresAt = acc.TokenExpiresAt
		existing.Metadata = acc.Metadata
		existing.NeedsReconnect = false
		existing.UpdatedAt = now
		if err := h.app.Repos.Accounts.Update(ctx, *existing); err != nil {
			return "", "", err
		}
		return existing.ID, tokens.Email, nil
	}

	if err := h.app.Repos.Accounts.Insert(ctx, acc); err != nil {
		return "", "", err
	}
	auditRecord(ctx, h.app, actor, "oauth.account.create", acc.ID, map[string]string{"provider": provider, "label": acc.Label})
	return acc.ID, tokens.Email, nil
}

// findExistingOAuthAccount returns the first matching OAuth account for the
// provider, checked in order of identity confidence: metadata email, then the
// refresh-token plaintext (unseal-and-compare — ciphertexts differ per seal).
func (h *oauthHandler) findExistingOAuthAccount(ctx context.Context, provider string, meta map[string]string, refreshToken string) (*models.Account, error) {
	accounts, err := h.app.Repos.Accounts.ListByProvider(ctx, provider)
	if err != nil {
		return nil, err
	}

	email := meta["email"]
	for i := range accounts {
		acc := accounts[i]
		if acc.AuthKind != models.AuthOAuth {
			continue
		}
		if email != "" && accountMetaValue(acc.Metadata, "email") == email {
			return &accounts[i], nil
		}
	}
	if refreshToken == "" {
		return nil, nil
	}
	for i := range accounts {
		acc := accounts[i]
		if acc.AuthKind != models.AuthOAuth || acc.Refresh.Empty() {
			continue
		}
		stored, err := h.app.Secrets.OpenString(fromModelsSealed(acc.Refresh))
		if err != nil {
			continue
		}
		if stored == refreshToken {
			return &accounts[i], nil
		}
	}
	return nil, nil
}

// accountMetaValue reads one string key out of an account's raw metadata JSON.
func accountMetaValue(raw, key string) string {
	if strings.TrimSpace(raw) == "" {
		return ""
	}
	var meta map[string]string
	if err := json.Unmarshal([]byte(raw), &meta); err != nil {
		return ""
	}
	return meta[key]
}

// oauthLabel derives a human label for an OAuth account.
func oauthLabel(label, provider string, tokens *oauth.Tokens) string {
	if label != "" {
		return label
	}
	if tokens.DisplayName != "" {
		return tokens.DisplayName
	}
	if tokens.Email != "" {
		return tokens.Email
	}
	return provider + " (oauth)"
}

// --- Fixed-loopback callback server (Codex) ---

// ensureLoopback binds the provider's fixed loopback callback listener when it
// has one, returning the port that ended up bound. Codex's OAuth app
// allow-lists localhost:1455 and 1457; the browser redirect must land on a
// port that is actually listening.
func (h *oauthHandler) ensureLoopback(cfg oauth.ProviderConfig) (int, error) {
	if cfg.FixedLoopbackPort <= 0 {
		return 0, nil
	}

	h.loopbackMu.Lock()
	defer h.loopbackMu.Unlock()
	if h.loopbackPort != 0 {
		return h.loopbackPort, nil
	}

	host := cfg.LoopbackHost
	if host == "" {
		host = "127.0.0.1"
	}
	ports := append([]int{cfg.FixedLoopbackPort}, cfg.FallbackPorts...)
	mux := http.NewServeMux()
	path := cfg.CallbackPath
	if path == "" {
		path = "/callback"
	}
	mux.HandleFunc("GET "+path, h.loopbackCallback)
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}

	var lastErr error
	for _, port := range ports {
		ln, err := net.Listen("tcp", net.JoinHostPort(host, fmt.Sprintf("%d", port)))
		if err != nil {
			lastErr = err
			continue
		}
		h.loopbackPort = port
		go func() {
			_ = srv.Serve(ln) // returns ErrServerClosed on shutdown; runs for the process lifetime
		}()
		return port, nil
	}
	return 0, fmt.Errorf("oauth: bind loopback callback: %w", lastErr)
}

// loopbackCallback receives the browser redirect for fixed-loopback providers,
// completes the exchange + persistence, and answers with a self-contained HTML
// page that postMessages the opener popup and closes it — no dashboard asset
// dependency.
func (h *oauthHandler) loopbackCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	writeResult := func(status, msg string) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(renderOAuthPopupResult(status, msg)))
	}

	if code == "" || state == "" {
		writeResult("error", "missing code or state parameter")
		return
	}
	sess, ok := h.sessions.Get(state)
	if !ok {
		writeResult("error", "session expired or invalid; please restart the sign-in flow")
		return
	}

	cfg, ok := oauth.ConfigFor(sess.Provider)
	if !ok {
		writeResult("error", "no OAuth config for provider: "+sess.Provider)
		return
	}
	tokens, err := cfg.ExchangeCode(r.Context(), code, sess.RedirectURI, sess.Verifier, state)
	if err != nil {
		writeResult("error", err.Error())
		return
	}
	h.sessions.Delete(state)

	if _, _, perr := h.persistAccount(r.Context(), "system", sess.Provider, "", tokens); perr != nil {
		writeResult("error", perr.Error())
		return
	}
	writeResult("success", "")
}

// renderOAuthPopupResult renders the callback page shown inside the sign-in
// popup. The inline script notifies the dashboard tab (window.opener) and
// closes the popup on its own.
func renderOAuthPopupResult(status, msg string) string {
	payload, _ := json.Marshal(map[string]string{"source": "tera-router-oauth", "status": status, "message": msg})
	title := "Connected"
	if status == "error" {
		title = "Sign-in failed"
	}
	return fmt.Sprintf(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>%s — Tera Router</title></head>
<body style="font-family: system-ui, sans-serif; display: grid; place-items: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa;">
<div style="text-align: center;">
<p style="font-size: 18px; font-weight: 600;">%s</p>
<p style="color: #a1a1aa; font-size: 14px;">%s</p>
<p style="color: #71717a; font-size: 12px;">You can close this window.</p>
</div>
<script>
try { if (window.opener) window.opener.postMessage(%s, "*"); } catch (e) {}
setTimeout(function () { window.close(); }, 800);
</script>
</body>
</html>`, title, title, msg, payload)
}

// validateOAuthRedirect restricts the browser-facing callback target: https
// anywhere, or plain http only on loopback hosts.
func validateOAuthRedirect(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("not a valid URL")
	}
	switch u.Scheme {
	case "https":
		return nil
	case "http":
		host := u.Hostname()
		if host == "localhost" || host == "127.0.0.1" || host == "::1" || strings.HasSuffix(host, ".localhost") {
			return nil
		}
		return fmt.Errorf("http callbacks are only allowed on loopback hosts")
	default:
		return fmt.Errorf("scheme must be http or https")
	}
}
