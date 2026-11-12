package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

const (
	// passkeyCeremonyTTL bounds how long a begun registration or sign-in
	// stays open; the server enforces it as well as the browser.
	passkeyCeremonyTTL = 5 * time.Minute
	// maxPendingCeremonies caps the whole store; maxCeremoniesPerIP keeps
	// one client from filling it and locking everyone out of passkeys.
	maxPendingCeremonies = 1000
	maxCeremoniesPerIP   = 10
	maxPasskeyName       = 64
)

var (
	// Registration failures are 422, not 401: the web client treats any 401
	// as an expired session and signs the user out.
	errPasskeyRejected = apperr.New(apperr.KindUnprocessable, "the passkey could not be verified")
)

// errPasskeyHost names the origin the server saw, so a proxy that drops or
// rewrites the Origin header is visible from the dashboard.
func errPasskeyHost(origin string) error {
	if origin == "" {
		origin = "(none)"
	}
	return apperr.New(apperr.KindBadRequest,
		"passkeys need the dashboard on https (or localhost) under a host name, not an IP address (request origin: %s)", origin)
}

// passkeysHandler serves passkey registration (signed in) and passkey
// sign-in (public). A passkey sign-in stands in for password and TOTP: the
// authenticator already verified the user (UV required).
type passkeysHandler struct {
	app        *app.Application
	ceremonies ceremonyStore
}

// ceremony is a begun WebAuthn ceremony waiting for its finish call.
type ceremony struct {
	session webauthn.SessionData
	origin  string
	userID  string // registration only
	ip      string
	expires time.Time
}

// ceremonyStore keeps begun ceremonies until finished; each is single use, so
// a captured response cannot be replayed.
// ponytail: in-process map, so begin and finish must reach the same api
// process; move it to the DB if the api ever runs as several replicas.
type ceremonyStore struct {
	mu sync.Mutex
	m  map[string]ceremony
}

func (s *ceremonyStore) put(c ceremony) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	if s.m == nil {
		s.m = map[string]ceremony{}
	}
	fromIP := 0
	oldestID := ""
	var oldestExpiry time.Time
	for k, v := range s.m {
		if now.After(v.expires) {
			delete(s.m, k)
			continue
		}
		if oldestID == "" || v.expires.Before(oldestExpiry) {
			oldestID, oldestExpiry = k, v.expires
		}
		if v.ip == c.ip {
			fromIP++
		}
	}
	// Only the per-client budget refuses a request: a flood from many
	// addresses must degrade the store, not lock everyone out of passkeys.
	if fromIP >= maxCeremoniesPerIP {
		return "", apperr.ErrTooManyRequests
	}
	// At the global cap, drop the ceremony closest to expiry so a begun flow
	// from a legitimate client always gets a slot.
	if len(s.m) >= maxPendingCeremonies && oldestID != "" {
		delete(s.m, oldestID)
	}
	id := uuid.NewString()
	c.expires = now.Add(passkeyCeremonyTTL)
	s.m[id] = c
	return id, nil
}

func (s *ceremonyStore) take(id string) (ceremony, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.m[id]
	delete(s.m, id)
	return c, ok && time.Now().Before(c.expires)
}

// relyingParty builds the WebAuthn config for the dashboard origin. The RP ID
// is that origin's host, so a passkey works only on the host it was made on
// (localhost, a tunnel domain, ...). Taking the origin from the request is
// safe: the browser binds credentials to the page's real origin, and the
// ceremony is pinned to the origin it began on.
func (h *passkeysHandler) relyingParty(origin string) (*webauthn.WebAuthn, error) {
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" || u.Path != "" {
		return nil, errPasskeyHost(origin)
	}
	host := u.Hostname()
	if net.ParseIP(host) != nil || (u.Scheme != "https" && !(u.Scheme == "http" && host == "localhost")) {
		return nil, errPasskeyHost(origin)
	}

	timeout := webauthn.TimeoutConfig{Enforce: true, Timeout: passkeyCeremonyTTL, TimeoutUVD: passkeyCeremonyTTL}
	name := h.app.Config.App.Name
	if name == "" {
		name = "Tera Router"
	}
	return webauthn.New(&webauthn.Config{
		RPID:          host,
		RPDisplayName: name,
		RPOrigins:     []string{origin},
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			ResidentKey:      protocol.ResidentKeyRequirementRequired,
			UserVerification: protocol.VerificationRequired,
		},
		Timeouts: webauthn.TimeoutsConfig{Login: timeout, Registration: timeout},
	})
}

// passkeyUser adapts a user and their stored credentials to webauthn.User.
// The user handle is the user id.
type passkeyUser struct {
	user  models.User
	creds []webauthn.Credential
}

func (u passkeyUser) WebAuthnID() []byte                         { return []byte(u.user.ID) }
func (u passkeyUser) WebAuthnName() string                       { return u.user.Email }
func (u passkeyUser) WebAuthnDisplayName() string                { return displayName(u.user) }
func (u passkeyUser) WebAuthnCredentials() []webauthn.Credential { return u.creds }

func (h *passkeysHandler) loadUser(ctx context.Context, userID string) (passkeyUser, error) {
	user, err := h.app.Repos.Users.Get(ctx, userID)
	if err != nil {
		return passkeyUser{}, err
	}
	rows, err := h.app.Repos.Passkeys.ListForUser(ctx, userID)
	if err != nil {
		return passkeyUser{}, err
	}
	pu := passkeyUser{user: user}
	for _, row := range rows {
		var cred webauthn.Credential
		if err := json.Unmarshal([]byte(row.Credential), &cred); err != nil {
			return passkeyUser{}, err
		}
		pu.creds = append(pu.creds, cred)
	}
	return pu, nil
}

func credentialID(raw []byte) string { return base64.RawURLEncoding.EncodeToString(raw) }

// List returns the signed-in user's passkeys (GET /v1/auth/passkeys).
func (h *passkeysHandler) List(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}
	rows, err := h.app.Repos.Passkeys.ListForUser(c.Context(), uid.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, rows)
}

// RegisterBegin starts adding a passkey (POST
// /v1/auth/passkeys/register/begin). It re-authenticates first: a new sign-in
// method must not be addable with a stolen session alone.
func (h *passkeysHandler) RegisterBegin(c fiber.Ctx) error {
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

	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}
	origin := c.Get(fiber.HeaderOrigin)
	rp, err := h.relyingParty(origin)
	if err != nil {
		return err
	}
	pu, err := h.loadUser(c.Context(), uid.String())
	if err != nil {
		return err
	}

	creation, session, err := rp.BeginRegistration(pu,
		webauthn.WithExclusions(webauthn.Credentials(pu.creds).CredentialDescriptors()))
	if err != nil {
		return err
	}
	id, err := h.ceremonies.put(ceremony{session: *session, origin: origin, userID: pu.user.ID, ip: clientOf(c).ip})
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"ceremony_id": id, "options": creation})
}

// RegisterFinish verifies the browser's new credential and stores it (POST
// /v1/auth/passkeys/register/finish).
func (h *passkeysHandler) RegisterFinish(c fiber.Ctx) error {
	var req dtos.PasskeyFinish
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}
	cer, ok := h.ceremonies.take(req.CeremonyID)
	if !ok || cer.userID != uid.String() {
		return errPasskeyRejected
	}
	rp, err := h.relyingParty(cer.origin)
	if err != nil {
		return err
	}
	pu, err := h.loadUser(c.Context(), cer.userID)
	if err != nil {
		return err
	}

	parsed, err := protocol.ParseCredentialCreationResponseBytes(req.Credential)
	if err != nil {
		return errPasskeyRejected
	}
	cred, err := rp.CreateCredential(pu, cer.session, parsed)
	if err != nil {
		return errPasskeyRejected
	}
	record, err := json.Marshal(cred)
	if err != nil {
		return err
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Passkey"
	}
	if r := []rune(name); len(r) > maxPasskeyName {
		name = string(r[:maxPasskeyName])
	}
	pk := models.Passkey{
		ID:           uuid.NewString(),
		UserID:       cer.userID,
		CredentialID: credentialID(cred.ID),
		RPID:         rp.Config.RPID,
		Name:         name,
		Credential:   string(record),
		CreatedAt:    time.Now(),
	}
	if err := h.app.Repos.Passkeys.Insert(c.Context(), pk); err != nil {
		return err
	}
	auditRecord(c, cer.userID, "auth.passkey_add", pk.ID, fiber.Map{"name": name, "rp_id": pk.RPID})
	return dtos.OK(c, pk)
}

// Delete removes one of the signed-in user's passkeys (DELETE
// /v1/auth/passkeys/:id).
func (h *passkeysHandler) Delete(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return err
	}
	id := c.Params("id")
	if err := h.app.Repos.Passkeys.DeleteForUser(c.Context(), id, uid.String()); err != nil {
		return err
	}
	auditRecord(c, uid.String(), "auth.passkey_delete", id, nil)
	return dtos.Message(c, fiber.StatusOK, "Passkey removed")
}

// SignInBegin starts a usernameless passkey sign-in (POST
// /v1/auth/passkey/begin). When OIDC_DISABLE_PASSWORD_LOGIN makes SSO the
// only way in, passkey sign-in is refused too — the operator asked for the
// IdP to hold authentication, so no non-SSO credential may open a session.
func (h *passkeysHandler) SignInBegin(c fiber.Ctx) error {
	if ssoOnly(h.app) {
		return apperr.New(apperr.KindForbidden, "passkey sign-in is disabled; sign in with SSO")
	}
	origin := c.Get(fiber.HeaderOrigin)
	rp, err := h.relyingParty(origin)
	if err != nil {
		return err
	}
	assertion, session, err := rp.BeginDiscoverableLogin()
	if err != nil {
		return err
	}
	id, err := h.ceremonies.put(ceremony{session: *session, origin: origin, ip: clientOf(c).ip})
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"ceremony_id": id, "options": assertion})
}

// SignInFinish verifies the passkey assertion and opens a session (POST
// /v1/auth/passkey/finish). Every failure is the same 401 — except the
// SSO-only guard, which also covers ceremonies begun before the flag took
// effect.
func (h *passkeysHandler) SignInFinish(c fiber.Ctx) error {
	if ssoOnly(h.app) {
		return apperr.New(apperr.KindForbidden, "passkey sign-in is disabled; sign in with SSO")
	}
	var req dtos.PasskeyFinish
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	cer, ok := h.ceremonies.take(req.CeremonyID)
	if !ok || cer.userID != "" {
		return apperr.ErrUnauthorized
	}
	rp, err := h.relyingParty(cer.origin)
	if err != nil {
		return err
	}
	parsed, err := protocol.ParseCredentialRequestResponseBytes(req.Credential)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	ctx := c.Context()
	var stored models.Passkey
	findUser := func(rawID, userHandle []byte) (webauthn.User, error) {
		pk, err := h.app.Repos.Passkeys.GetByCredentialID(ctx, credentialID(rawID))
		if err != nil {
			return nil, err
		}
		if pk.UserID != string(userHandle) {
			return nil, errors.New("passkey: user handle does not match the credential owner")
		}
		stored = pk
		return h.loadUser(ctx, pk.UserID)
	}
	waUser, cred, err := rp.ValidatePasskeyLogin(findUser, cer.session, parsed)
	if err != nil || cred.Authenticator.CloneWarning {
		return apperr.ErrUnauthorized
	}
	user := waUser.(passkeyUser).user
	if !user.IsActive || user.IsBlocked {
		return apperr.ErrUnauthorized
	}

	record, err := json.Marshal(cred)
	if err != nil {
		return err
	}
	if err := h.app.Repos.Passkeys.MarkUsed(ctx, stored.ID, string(record)); err != nil {
		return err
	}

	auth := &authHandler{app: h.app}
	session, err := auth.openSession(ctx, user, clientOf(c), "passkey")
	if err != nil {
		return err
	}
	consoleInfof("sign-in · %s (passkey)", user.Email)
	lib.ContextSetSID(c, session.SessionID)
	auditRecord(c, user.ID, "auth.sign_in", user.ID, fiber.Map{"method": "passkey", "passkey": stored.ID})
	return dtos.OK(c, sessionView(session))
}
