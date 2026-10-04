package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"net"
	"net/http"
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
// (anthropic, codex), ported from the IDRouter reference. Starting a flow and
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

// Authorize starts an authorization-code + PKCE flow. It returns the provider
// authorize URL the dashboard should open, and stores the PKCE verifier +
// state server-side keyed by state.
func (h *oauthHandler) Authorize(c fiber.Ctx) error {
	provider := c.Params("provider")
	cfg, ok := oauth.ConfigFor(provider)
	if !ok {
		return apperr.New(apperr.KindBadRequest, "no OAuth config for provider: %s", provider)
	}

	// Fixed-port providers must advertise the port this server actually owns,
	// so bind before resolving: Codex's OAuth app also allow-lists 1457,
	// letting a busy 1455 fall back instead of failing the flow.
	boundPort, err := h.ensureLoopback(cfg)
	if err != nil {
		return apperr.New(apperr.KindConflict, "%s", err.Error())
	}
	redirectURI := cfg.ResolveRedirectURI(boundPort)

	pkce, err := oauth.GeneratePKCE()
	if err != nil {
		return err
	}
	authURL := cfg.AuthURL(redirectURI, pkce.State, pkce.Challenge)

	// How the flow completes: anthropic's OAuth app pins the redirect to its
	// console display-code callback, so the dashboard collects the shown code
	// (paste_code); codex's fixed loopback redirect lands on the server's own
	// listener (loopback). The dashboard decides how to wait for the loopback
	// result based on where it is served from.
	completion := "loopback"
	if cfg.FixedRedirectURI != "" {
		completion = "paste_code"
	}

	h.sessions.Put(pkce.State, &oauth.Session{
		Provider:    provider,
		State:       pkce.State,
		Verifier:    pkce.Verifier,
		RedirectURI: redirectURI,
	})

	return dtos.OK(c, fiber.Map{
		"authorize_url": authURL,
		"state":         pkce.State,
		"redirect_uri":  redirectURI,
		"completion":    completion,
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

	sess, ok := h.sessions.Get(req.State)
	if !ok || sess.Provider != provider {
		return apperr.New(apperr.KindBadRequest, "OAuth session not found or expired; restart the flow")
	}
	tokens, err := cfg.ExchangeCode(c.Context(), req.Code, sess.RedirectURI, sess.Verifier, req.State)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	h.sessions.Delete(req.State)

	id, email, perr := h.persistAccount(c.Context(), actorFrom(c), cfg.Provider, tokens)
	if perr != nil {
		return perr
	}
	return dtos.Created(c, fiber.Map{"id": id, "provider": cfg.Provider, "email": email}, "OAuth account connected")
}

// persistAccount seals OAuth tokens into an account record, deduplicating on
// the account identity (metadata email first, then the refresh-token
// plaintext): reconnecting the same grant updates the existing row in place
// instead of creating a duplicate.
func (h *oauthHandler) persistAccount(ctx context.Context, actor, provider string, tokens *oauth.Tokens) (string, string, error) {
	// An OAuth connect on a seedable catalog provider persists its
	// custom_providers row too (no-op for subscription-only slugs like codex).
	if _, err := ensureCustomProviderRow(ctx, h.app, actor, provider); err != nil {
		return "", "", err
	}

	now := time.Now()

	acc := models.Account{
		ID:        uuid.NewString(),
		Provider:  provider,
		Label:     oauthLabel(provider, tokens),
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
	acc.Token = sealedAccess
	if tokens.RefreshToken != "" {
		sealedRefresh, serr := h.app.Secrets.SealString(tokens.RefreshToken)
		if serr != nil {
			return "", "", apperr.New(apperr.KindInternal, "seal refresh token: %s", serr.Error())
		}
		acc.Refresh = sealedRefresh
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
		// A grant re-consent may come back without a refresh token; keeping
		// the stored one preserves the ability to refresh the new access
		// token.
		if !acc.Refresh.Empty() {
			existing.Refresh = acc.Refresh
		}
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
		stored, err := h.app.Secrets.OpenString(acc.Refresh)
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
func oauthLabel(provider string, tokens *oauth.Tokens) string {
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

	ports := append([]int{cfg.FixedLoopbackPort}, cfg.FallbackPorts...)
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+cfg.CallbackPath, h.loopbackCallback)
	// The callback handler can block up to httpClientTimeout in the token
	// exchange before writing, so WriteTimeout must exceed it or slow/awkward
	// clients would see the response cut off; the other limits just stop
	// abandoned connections from lingering on this process-lifetime listener.
	const (
		readTimeout       = 10 * time.Second
		writeTimeout      = 60 * time.Second
		idleTimeout       = 60 * time.Second
		readHeaderTimeout = 5 * time.Second
	)
	srv := &http.Server{
		Handler:           mux,
		ReadTimeout:       readTimeout,
		ReadHeaderTimeout: readHeaderTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}

	var lastErr error
	for _, port := range ports {
		ln, err := net.Listen("tcp", net.JoinHostPort(cfg.LoopbackHost, fmt.Sprintf("%d", port)))
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

	if _, _, perr := h.persistAccount(r.Context(), "system", cfg.Provider, tokens); perr != nil {
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
	// The message can echo provider-controlled error strings, so it is
	// escaped for the HTML text nodes; the JSON payload is embedded in the
	// script, where json.Marshal's escaping already applies, and stays raw.
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
</html>`, html.EscapeString(title), html.EscapeString(title), html.EscapeString(msg), payload)
}
