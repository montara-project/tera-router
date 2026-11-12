package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/url"
	"strings"
	"sync"
	"time"

	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gofiber/fiber/v3"
	"golang.org/x/oauth2"
)

const (
	// oidcStateTTL bounds how long a begun SSO sign-in stays open: the
	// provider round-trip must finish inside it.
	oidcStateTTL = 10 * time.Minute
	// oidcTicketTTL bounds how long the one-time ticket the callback issues
	// stays redeemable by the dashboard.
	oidcTicketTTL = time.Minute
	// oidcPendingTTL bounds how long a TOTP-gated SSO sign-in waits for the
	// authenticator code.
	oidcPendingTTL = 5 * time.Minute
)

// oidcState is a begun SSO sign-in: the nonce the returned id_token must
// carry, the PKCE verifier the code exchange must present, and the dashboard
// origin to send the browser back to — taken from the login request's
// Referer so a split-origin dashboard lands on itself.
type oidcState struct {
	nonce    string
	verifier string
	uiOrigin string
	// flow binds the issued ticket to the browser tab that began this
	// sign-in; the web client generates it and must repeat it at exchange.
	flow string
}

// ttlEntry is one stored value with its deadline.
type ttlEntry[V any] struct {
	value   V
	expires time.Time
}

// ttlStore keeps single-use entries until taken or expired; expired entries
// are swept lazily on access. It backs the OIDC state and ticket maps.
// ponytail: in-process map, so login, callback and exchange must reach the
// same api process; move it to the DB if the api ever runs as several replicas.
type ttlStore[V any] struct {
	mu sync.Mutex
	m  map[string]ttlEntry[V]
}

func (s *ttlStore[V]) put(key string, v V, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.m == nil {
		s.m = map[string]ttlEntry[V]{}
	}
	now := time.Now()
	for k, e := range s.m {
		if !now.Before(e.expires) {
			delete(s.m, k)
		}
	}
	s.m[key] = ttlEntry[V]{value: v, expires: now.Add(ttl)}
}

// take reads and removes key: every entry is single use, so a captured
// state or ticket cannot be replayed.
func (s *ttlStore[V]) take(key string) (V, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.m[key]
	delete(s.m, key)
	if !ok || !time.Now().Before(e.expires) {
		var zero V
		return zero, false
	}
	return e.value, true
}

// peek reads key without consuming it: a pending TOTP entry must survive a
// wrong code (the password flow lets the client resubmit too), so it is read
// with peek and spent with take once the factor passes.
func (s *ttlStore[V]) peek(key string) (V, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.m[key]
	if !ok || !time.Now().Before(e.expires) {
		var zero V
		return zero, false
	}
	return e.value, true
}

// randHex returns n cryptographically random bytes hex-encoded.
func randHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// uiOriginFromReferer keeps only the scheme://host of the Referer the login
// request came from, so the callback can redirect the browser back to the
// dashboard that started the sign-in. An absent, malformed or non-http(s)
// value yields "" — the callback then redirects to a relative path.
func uiOriginFromReferer(referer string) string {
	u, err := url.Parse(referer)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

// uiOriginAllowed reports whether origin may receive the ticket redirect: the
// request's own origin always may, plus every origin the operator declared in
// CORS_ALLOWED_ORIGINS. A Referer pointing anywhere else is ignored — a login
// link planted on a foreign site must not redirect the ticket to an origin
// the operator did not declare. The wildcard "*" is not an origin and never
// matches.
func uiOriginAllowed(origin, baseURL, corsOrigins string) bool {
	if origin == "" {
		return false
	}
	if origin == baseURL {
		return true
	}
	for _, o := range strings.Split(corsOrigins, ",") {
		if strings.TrimSpace(o) == origin {
			return true
		}
	}
	return false
}

// uiOrigin returns the Referer origin when it is allowed, "" otherwise —
// the callback then redirects to a relative path on the API's own origin.
func (h *authHandler) uiOrigin(c fiber.Ctx) string {
	ref := uiOriginFromReferer(c.Get(fiber.HeaderReferer))
	if !uiOriginAllowed(ref, c.BaseURL(), h.app.Config.App.CORSAllowedOrigins) {
		return ""
	}
	return ref
}

// ssoTicket is the one-time redemption for the session the callback opened:
// flow binds it to the browser that began the sign-in when the initiation
// carried one; an empty flow means the ticket is unbound.
type ssoTicket struct {
	view fiber.Map
	flow string
}

// ssoPending holds a verified-identity sign-in that still owes the account's
// TOTP factor: the session is opened only after the code checks out.
type ssoPending struct {
	userID string
	flow   string
}

// oidcEnabled reports whether dashboard SSO is configured: all three OIDC
// settings must be set.
func (h *authHandler) oidcEnabled() bool {
	cfg := h.app.Config.OIDC
	return cfg.Issuer != "" && cfg.ClientID != "" && cfg.ClientSecret != ""
}

// oidcProvider returns the discovered provider, built once on first use —
// discovery is a network call. A failure is not cached so the next attempt
// retries against a provider that may have come back.
func (h *authHandler) oidcProvider(ctx context.Context) (*oidc.Provider, error) {
	h.oidcMu.Lock()
	defer h.oidcMu.Unlock()
	if h.oidcProv != nil {
		return h.oidcProv, nil
	}
	p, err := oidc.NewProvider(ctx, h.app.Config.OIDC.Issuer)
	if err != nil {
		return nil, err
	}
	h.oidcProv = p
	return p, nil
}

// oidcOAuth2Config builds the oauth2 config for one request. An explicit
// OIDC_REDIRECT_URL wins — set it behind a proxy that does not forward the
// public scheme. Otherwise the redirect URI echoes the request's own base
// URL, so it works on whichever host the dashboard reached the API through —
// localhost, a tunnel domain, the public URL — as long as the provider
// registered that callback.
func (h *authHandler) oidcOAuth2Config(c fiber.Ctx, provider *oidc.Provider) *oauth2.Config {
	cfg := h.app.Config.OIDC
	redirectURL := cfg.RedirectURL
	if redirectURL == "" {
		redirectURL = c.BaseURL() + "/v1/auth/oidc/callback"
	}
	return &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  redirectURL,
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
}

// OIDCConfig tells the login page whether to render the SSO button (GET
// /v1/auth/oidc/config).
func (h *authHandler) OIDCConfig(c fiber.Ctx) error {
	return dtos.OK(c, fiber.Map{
		"enabled":       h.oidcEnabled(),
		"provider_name": h.app.Config.OIDC.ProviderName,
	})
}

// OIDCLogin starts an SSO sign-in (GET /v1/auth/oidc/login): it stores the
// state/nonce pair and the dashboard origin, then redirects to the provider's
// authorize endpoint.
func (h *authHandler) OIDCLogin(c fiber.Ctx) error {
	if !h.oidcEnabled() {
		return apperr.ErrNotFound
	}
	provider, err := h.oidcProvider(c.Context())
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "OIDC provider discovery failed: %s", err.Error())
	}
	state, err := randHex(32)
	if err != nil {
		return err
	}
	nonce, err := randHex(32)
	if err != nil {
		return err
	}
	verifier := oauth2.GenerateVerifier()
	h.oidcStates.put(state, oidcState{
		nonce:    nonce,
		verifier: verifier,
		uiOrigin: h.uiOrigin(c),
		flow:     c.Query("flow"),
	}, oidcStateTTL)

	authURL := h.oidcOAuth2Config(c, provider).AuthCodeURL(
		state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier))
	return c.Redirect().Status(fiber.StatusFound).To(authURL)
}

// OIDCCallback completes an SSO sign-in (GET /v1/auth/oidc/callback). The
// browser arrives through a provider redirect, so every failure answers with
// a redirect back to the dashboard's login page carrying a short sso_error
// code — never a JSON body the browser would just display.
func (h *authHandler) OIDCCallback(c fiber.Ctx) error {
	st, ok := h.oidcStates.take(c.Query("state"))
	if !ok {
		auditRecord(c, "", "auth.sso_sign_in", "", fiber.Map{"method": "oidc", "error": "invalid_state"})
		return c.Redirect().Status(fiber.StatusFound).To("/?sso_error=invalid_state")
	}

	// fail records the refused sign-in and sends the browser home with the
	// error code the login page translates into a message.
	fail := func(code, email string) error {
		auditRecord(c, "", "auth.sso_sign_in", email, fiber.Map{"method": "oidc", "error": code})
		return c.Redirect().Status(fiber.StatusFound).To(st.uiOrigin + "/?sso_error=" + code)
	}

	ctx := c.Context()
	if !h.oidcEnabled() {
		return fail("not_enabled", "")
	}
	code := c.Query("code")
	if code == "" {
		return fail("missing_code", "")
	}
	provider, err := h.oidcProvider(ctx)
	if err != nil {
		return fail("provider_error", "")
	}

	token, err := h.oidcOAuth2Config(c, provider).Exchange(ctx, code, oauth2.VerifierOption(st.verifier))
	if err != nil {
		return fail("exchange_failed", "")
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return fail("missing_id_token", "")
	}
	idToken, err := provider.Verifier(&oidc.Config{ClientID: h.app.Config.OIDC.ClientID}).Verify(ctx, rawIDToken)
	if err != nil {
		return fail("invalid_id_token", "")
	}
	var claims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Nonce         string `json:"nonce"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return fail("invalid_id_token", "")
	}
	if claims.Nonce != st.nonce {
		return fail("invalid_nonce", "")
	}
	if claims.Email == "" {
		return fail("no_email", "")
	}
	if !claims.EmailVerified {
		// Only an email the provider vouches for may match a dashboard
		// account — otherwise anyone controlling an IdP account could claim
		// an address they do not own.
		return fail("email_unverified", claims.Email)
	}

	user, err := h.app.Repos.Users.GetByEmail(ctx, claims.Email)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			// SSO never provisions accounts: the email must already exist as
			// an active, unblocked dashboard user.
			return fail("no_account", claims.Email)
		}
		return fail("internal", claims.Email)
	}
	if !user.IsActive || user.IsBlocked {
		return fail("no_account", claims.Email)
	}

	if user.TOTPEnabled {
		// The account opted into two factors: IdP authentication is one, the
		// authenticator code is still owed. Hold the verified identity and
		// send the browser to the OTP step; the session is opened by
		// /oidc/verify-totp after the code checks out.
		ticket, err := randHex(32)
		if err != nil {
			return err
		}
		h.oidcPending.put(ticket, ssoPending{userID: user.ID, flow: st.flow}, oidcPendingTTL)
		auditRecord(c, user.ID, "auth.sso_sign_in", user.ID, fiber.Map{"method": "oidc", "totp": "pending"})
		return c.Redirect().Status(fiber.StatusFound).To(st.uiOrigin + "/?sso_totp=" + ticket)
	}

	session, err := h.openSession(ctx, user, clientOf(c))
	if err != nil {
		return fail("internal", claims.Email)
	}
	ticket, err := randHex(32)
	if err != nil {
		return err
	}
	h.oidcTickets.put(ticket, ssoTicket{view: sessionView(session), flow: st.flow}, oidcTicketTTL)

	consoleInfof("sign-in · %s (sso)", user.Email)
	lib.ContextSetSID(c, session.SessionID)
	auditRecord(c, user.ID, "auth.sso_sign_in", user.ID, fiber.Map{"method": "oidc"})
	return c.Redirect().Status(fiber.StatusFound).To(st.uiOrigin + "/?sso_ticket=" + ticket)
}

// OIDCExchange redeems the ticket the callback appended to its redirect for
// the session it stored (POST /v1/auth/oidc/exchange). The token pair never
// travels through a redirect URL, and a leaked or refreshed ticket is useless
// after its minute or its first use.
func (h *authHandler) OIDCExchange(c fiber.Ctx) error {
	var req dtos.OIDCExchange
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	t, ok := h.oidcTickets.take(req.Ticket)
	if !ok {
		return apperr.ErrUnauthorized
	}
	// A bound ticket only redeems for the browser that began the sign-in: it
	// must repeat the flow id it generated in its session storage.
	if t.flow != "" && t.flow != req.Flow {
		return apperr.ErrUnauthorized
	}
	return dtos.OK(c, t.view)
}

// OIDCVerifyTOTP completes a TOTP-gated SSO sign-in (POST
// /v1/auth/oidc/verify-totp): the callback left a verified identity pending
// for accounts with two-factor on; a correct code spends it and opens the
// session. The entry is peeked, not taken, so a wrong code lets the client
// retry like the password flow does.
func (h *authHandler) OIDCVerifyTOTP(c fiber.Ctx) error {
	var req dtos.OIDCVerifyTOTP
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	pend, ok := h.oidcPending.peek(req.Ticket)
	if !ok || (pend.flow != "" && pend.flow != req.Flow) {
		return apperr.ErrUnauthorized
	}

	ctx := c.Context()
	user, err := h.app.Repos.Users.Get(ctx, pend.userID)
	if err != nil || !user.IsActive || user.IsBlocked {
		return apperr.ErrUnauthorized
	}
	if err := h.checkTOTP(ctx, user, req.OTP); err != nil {
		auditRecord(c, "", "auth.sso_sign_in", pend.userID, fiber.Map{"method": "oidc", "error": "totp"})
		return err
	}
	if _, ok := h.oidcPending.take(req.Ticket); !ok {
		// A sibling request spent it between the peek and now.
		return apperr.ErrUnauthorized
	}

	session, err := h.openSession(ctx, user, clientOf(c))
	if err != nil {
		return err
	}
	consoleInfof("sign-in · %s (sso)", user.Email)
	lib.ContextSetSID(c, session.SessionID)
	auditRecord(c, user.ID, "auth.sso_sign_in", user.ID, fiber.Map{"method": "oidc", "totp": true})
	return dtos.OK(c, sessionView(session))
}
