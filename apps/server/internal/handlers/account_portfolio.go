package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// Per-provider accounts backup: a focused sibling of the configuration
// backup (backup.go) that moves just one provider's accounts between
// installs. The file is always portable — credentials are sealed under a
// passphrase, never under this install's APP_SECRET — and importing it only
// adds accounts.

const (
	accountsBackupFormat  = "tera-router.accounts"
	accountsBackupVersion = 1
)

type accountsBackup struct {
	Format     string          `json:"format"`
	Version    int             `json:"version"`
	AppVersion string          `json:"app_version"`
	ExportedAt time.Time       `json:"exported_at"`
	Provider   string          `json:"provider"`
	Portable   *portableHeader `json:"portable"`
	Accounts   []backupAccount `json:"accounts"`
}

// backupAccount is one account in the file. Secret, Token and Refresh hold
// the credential sealed under the passphrase; an absent one is empty. The
// proxy pool is left out: its id means nothing on another install.
type backupAccount struct {
	Label          string          `json:"label"`
	AuthKind       models.AuthKind `json:"auth_kind"`
	Priority       int             `json:"priority"`
	Disabled       bool            `json:"disabled"`
	NeedsReconnect bool            `json:"needs_reconnect"`
	Metadata       json.RawMessage `json:"metadata"`
	TokenExpiresAt *time.Time      `json:"token_expires_at"`
	Secret         string          `json:"secret,omitempty"`
	Token          string          `json:"token,omitempty"`
	Refresh        string          `json:"refresh,omitempty"`
}

// Export downloads every account of one provider as a passphrase-encrypted
// file (POST /v1/providers/:id/accounts/export, :id = provider slug). The
// caller re-authenticates first: the passphrase they choose decrypts every
// credential in the file.
func (h *accountsHandler) Export(c fiber.Ctx) error {
	slug := c.Params("id")
	var req dtos.AccountsExport
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

	accounts, err := h.app.Repos.Accounts.ListByProvider(c.Context(), slug)
	if err != nil {
		return err
	}
	if len(accounts) == 0 {
		return apperr.New(apperr.KindNotFound, "this provider has no accounts to export")
	}

	// One key for the whole file: argon2 runs once, not once per credential.
	// The passphrase is trimmed here exactly as Import trims it, or a backup
	// sealed with a padded passphrase could never be opened again.
	ps, err := sealer.NewPortable(strings.TrimSpace(req.Passphrase))
	if err != nil {
		return err
	}
	check, err := ps.Seal(portableCheck)
	if err != nil {
		return err
	}
	doc := accountsBackup{
		Format:     accountsBackupFormat,
		Version:    accountsBackupVersion,
		AppVersion: app.Version,
		ExportedAt: time.Now().UTC(),
		Provider:   slug,
		Portable:   &portableHeader{KDF: "argon2id", Salt: ps.Salt(), Check: check},
		Accounts:   make([]backupAccount, 0, len(accounts)),
	}

	rekey := func(sealed sealer.Sealed, purpose, accountID string) (string, error) {
		if sealed.Empty() {
			return "", nil
		}
		plain, err := h.app.Secrets.OpenString(sealed, purpose)
		if err != nil {
			return "", apperr.New(apperr.KindInternal, "cannot open a credential of account %s: %s", accountID, err.Error())
		}
		return ps.Seal(plain)
	}
	for _, a := range accounts {
		out := backupAccount{
			Label:          a.Label,
			AuthKind:       a.AuthKind,
			Priority:       a.Priority,
			Disabled:       a.Disabled,
			NeedsReconnect: a.NeedsReconnect,
			Metadata:       json.RawMessage(orEmptyJSON(a.Metadata)),
			TokenExpiresAt: a.TokenExpiresAt,
		}
		if out.Secret, err = rekey(a.Secret, sealer.PurposeAccountSecret, a.ID); err != nil {
			return err
		}
		if out.Token, err = rekey(a.Token, sealer.PurposeAccountToken, a.ID); err != nil {
			return err
		}
		if out.Refresh, err = rekey(a.Refresh, sealer.PurposeAccountRefresh, a.ID); err != nil {
			return err
		}
		doc.Accounts = append(doc.Accounts, out)
	}

	raw, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return err
	}
	auditRecord(c, actorFrom(c), "account.export", slug, map[string]int{"accounts": len(doc.Accounts)})

	c.Attachment(fmt.Sprintf("tera-router-%s-accounts-%s.json", slug, time.Now().UTC().Format("20060102-150405")))
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSONCharsetUTF8)
	return c.Send(raw)
}

type accountsImportRequest struct {
	Passphrase string          `json:"passphrase"`
	Backup     json.RawMessage `json:"backup"`
}

// idrouterImportLimit caps the accounts accepted from an IDrouter file. That
// format salts every secret separately, so each one costs a full argon2id
// derivation (64 MiB, 4 threads) — unlike this install's own export, which pays
// argon2 once per file. The cap is what keeps one request from occupying the
// process for minutes.
const idrouterImportLimit = 200

// idrouterPortfolioKind marks IDrouter's per-provider accounts export. The
// file is accepted as-is: its secrets are sealed per secret with their own
// salt under the same argon2id profile this install's portable sealer uses, so
// a conversion needs no external tool.
const idrouterPortfolioKind = "account-portfolio"

// idrouterPortfolio is the envelope IDrouter writes for one provider's
// accounts. Metadata is a JSON string there, and every secret is a
// {salt, ciphertext} pair.
type idrouterPortfolio struct {
	Kind     string            `json:"kind"`
	Provider string            `json:"provider"`
	Portable bool              `json:"portable"`
	Accounts []idrouterAccount `json:"accounts"`
}

type idrouterAccount struct {
	Label          string            `json:"label"`
	AuthKind       models.AuthKind   `json:"auth_kind"`
	Priority       int               `json:"priority"`
	Disabled       bool              `json:"disabled"`
	Metadata       string            `json:"metadata"`
	TokenExpiresAt *string           `json:"token_expires_at"`
	PortableSecret idrouterSecretSet `json:"portable_secret"`
}

type idrouterSecretSet struct {
	Secret  *idrouterSecret `json:"secret"`
	Token   *idrouterSecret `json:"token"`
	Refresh *idrouterSecret `json:"refresh"`
}

type idrouterSecret struct {
	Salt       string `json:"salt"`
	Ciphertext string `json:"ciphertext"`
}

// convertIDrouterPortfolio rewrites an IDrouter export into this install's
// backup document: each secret is opened with the passphrase and its own salt,
// then re-sealed under one fresh salt so the rest of the import runs unchanged.
// The file carries no passphrase check, so the first secret that fails to open
// is the only evidence of a wrong passphrase.
func convertIDrouterPortfolio(raw json.RawMessage, passphrase string) (accountsBackup, error) {
	var doc idrouterPortfolio
	if err := json.Unmarshal(raw, &doc); err != nil {
		return accountsBackup{}, apperr.New(apperr.KindBadRequest, "invalid IDrouter accounts file: %s", err.Error())
	}
	if !doc.Portable {
		// Secrets arrive passphrase-sealed only; a file that says otherwise
		// would hold blobs this install cannot open, and reporting that as a
		// decrypt failure would be misleading.
		return accountsBackup{}, apperr.New(apperr.KindUnprocessable, "this IDrouter file is not a portable export")
	}
	// Checked before any decryption: the work is per secret, and a file that
	// large must be split rather than served in one request.
	if len(doc.Accounts) > idrouterImportLimit {
		return accountsBackup{}, apperr.New(apperr.KindUnprocessable, "the IDrouter file holds %d accounts; at most %d import at once — export it in smaller batches", len(doc.Accounts), idrouterImportLimit)
	}
	ps, err := sealer.NewPortable(passphrase)
	if err != nil {
		return accountsBackup{}, apperr.New(apperr.KindBadRequest, "enter the backup's passphrase to import it")
	}
	check, err := ps.Seal(portableCheck)
	if err != nil {
		return accountsBackup{}, err
	}
	out := accountsBackup{
		Format:     accountsBackupFormat,
		Version:    accountsBackupVersion,
		AppVersion: app.Version,
		ExportedAt: time.Now().UTC(),
		Provider:   doc.Provider,
		Portable:   &portableHeader{KDF: "argon2id", Salt: ps.Salt(), Check: check},
		Accounts:   make([]backupAccount, 0, len(doc.Accounts)),
	}

	opened := false
	reseal := func(secret *idrouterSecret, label string) (string, error) {
		if secret == nil {
			return "", nil
		}
		open, err := sealer.OpenPortable(passphrase, secret.Salt)
		if err != nil {
			return "", apperr.New(apperr.KindUnprocessable, "account %q has a corrupt secret header", label)
		}
		plain, err := open.Open(secret.Ciphertext)
		if err != nil {
			if !opened {
				return "", apperr.New(apperr.KindBadRequest, "wrong passphrase")
			}
			return "", apperr.New(apperr.KindUnprocessable, "cannot decrypt a credential of account %q", label)
		}
		opened = true
		return ps.Seal(plain)
	}

	for _, a := range doc.Accounts {
		label := a.Label
		kind := a.AuthKind
		if kind == "" {
			kind = models.AuthAPIKey
		}
		metadata := strings.TrimSpace(a.Metadata)
		if metadata == "" {
			metadata = "{}"
		}
		if !json.Valid([]byte(metadata)) {
			return accountsBackup{}, apperr.New(apperr.KindUnprocessable, "account %q has malformed metadata", label)
		}
		var expiresAt *time.Time
		if a.TokenExpiresAt != nil && strings.TrimSpace(*a.TokenExpiresAt) != "" {
			t, err := time.Parse(time.RFC3339, strings.TrimSpace(*a.TokenExpiresAt))
			if err != nil {
				return accountsBackup{}, apperr.New(apperr.KindUnprocessable, "account %q has a malformed token_expires_at", label)
			}
			expiresAt = &t
		}
		account := backupAccount{
			Label:          label,
			AuthKind:       kind,
			Priority:       a.Priority,
			Disabled:       a.Disabled,
			Metadata:       json.RawMessage(metadata),
			TokenExpiresAt: expiresAt,
		}
		for _, f := range []struct {
			secret *idrouterSecret
			into   *string
		}{{a.PortableSecret.Secret, &account.Secret}, {a.PortableSecret.Token, &account.Token}, {a.PortableSecret.Refresh, &account.Refresh}} {
			if *f.into, err = reseal(f.secret, label); err != nil {
				return accountsBackup{}, err
			}
		}
		out.Accounts = append(out.Accounts, account)
	}
	// A file whose accounts carry no secret at all cannot prove its passphrase;
	// that is a damaged file, not a wrong passphrase.
	if !opened && len(out.Accounts) > 0 {
		return accountsBackup{}, apperr.New(apperr.KindUnprocessable, "the IDrouter file holds no credentials to open")
	}
	return out, nil
}

// accountsImportSkip names one account the import left out, and why.
type accountsImportSkip struct {
	Label  string `json:"label"`
	Reason string `json:"reason"`
}

// Import adds the accounts of an Export file to one provider
// (POST /v1/providers/:id/accounts/import, :id = provider slug). It is
// additive: an account whose credential is already stored is skipped and no
// existing row is changed, so importing a file twice is safe and the import
// has the reach of POST /v1/accounts — no more.
func (h *accountsHandler) Import(c fiber.Ctx) error {
	// The provider must exist here: accounts of an unknown slug would be
	// stored but never routed to.
	slug, err := (&providersHandler{app: h.app}).routingProvider(c)
	if err != nil {
		return err
	}

	var req accountsImportRequest
	if err := json.Unmarshal(c.Body(), &req); err != nil {
		return apperr.New(apperr.KindBadRequest, "invalid backup JSON: %s", err.Error())
	}
	var doc accountsBackup
	trimmed := bytes.TrimSpace(req.Backup)
	if len(trimmed) > 0 && trimmed[0] == '{' {
		var probe struct {
			Kind     string `json:"kind"`
			Provider string `json:"provider"`
		}
		_ = json.Unmarshal(trimmed, &probe)
		if probe.Kind == idrouterPortfolioKind {
			// Check the provider before touching a passphrase: the conversion
			// runs argon2 per secret, which a misplaced file must not pay for.
			if probe.Provider != "" && probe.Provider != slug {
				return apperr.New(apperr.KindUnprocessable, "this backup holds %s accounts, not %s", probe.Provider, slug)
			}
			if doc, err = convertIDrouterPortfolio(trimmed, strings.TrimSpace(req.Passphrase)); err != nil {
				return err
			}
		}
	}
	if doc.Format == "" {
		if err := json.Unmarshal(req.Backup, &doc); err != nil {
			return apperr.New(apperr.KindBadRequest, "invalid backup JSON: %s", err.Error())
		}
	}
	if doc.Format != accountsBackupFormat || doc.Portable == nil {
		return apperr.New(apperr.KindUnprocessable, "not a Tera Router accounts backup")
	}
	if doc.Version < 1 || doc.Version > accountsBackupVersion {
		return apperr.New(apperr.KindUnprocessable, "unsupported accounts backup version %d", doc.Version)
	}
	if doc.Provider != slug {
		return apperr.New(apperr.KindUnprocessable, "this backup holds %s accounts, not %s", doc.Provider, slug)
	}
	if len(doc.Accounts) == 0 {
		return apperr.New(apperr.KindUnprocessable, "the backup contains no accounts")
	}
	// ponytail: the duplicate check below rescans the provider's accounts per
	// row, so the work grows with rows x stored accounts. The cap keeps that
	// bounded; index emails and refresh tokens in memory if it must go up.
	if len(doc.Accounts) > maxBulkKeys {
		return apperr.New(apperr.KindUnprocessable, "the backup holds %d accounts; at most %d import at once", len(doc.Accounts), maxBulkKeys)
	}
	passphrase := strings.TrimSpace(req.Passphrase)
	if passphrase == "" {
		return apperr.New(apperr.KindBadRequest, "enter the backup's passphrase to import it")
	}
	ps, err := sealer.OpenPortable(passphrase, doc.Portable.Salt)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "corrupt accounts backup header")
	}
	if got, err := ps.Open(doc.Portable.Check); err != nil || got != portableCheck {
		return apperr.New(apperr.KindBadRequest, "wrong passphrase")
	}

	// Decrypt and validate the whole file before anything is stored, so a
	// damaged file imports nothing instead of half of itself.
	inputs := make([]accountInput, len(doc.Accounts))
	for i, ba := range doc.Accounts {
		switch ba.AuthKind {
		case models.AuthAPIKey, models.AuthOAuth, models.AuthNone:
		default:
			return apperr.New(apperr.KindUnprocessable, "account %q has an unknown auth kind", ba.Label)
		}
		var meta map[string]any
		if err := json.Unmarshal([]byte(orEmptyJSON(string(ba.Metadata))), &meta); err != nil {
			return apperr.New(apperr.KindUnprocessable, "account %q has malformed metadata", ba.Label)
		}
		in := accountInput{Metadata: encodeMetadata(meta)}
		for _, f := range []struct {
			sealed string
			into   *string
		}{{ba.Secret, &in.APIKey}, {ba.Token, &in.Token}, {ba.Refresh, &in.Refresh}} {
			if f.sealed == "" {
				continue
			}
			if *f.into, err = ps.Open(f.sealed); err != nil {
				return apperr.New(apperr.KindUnprocessable, "cannot decrypt a credential of account %q", ba.Label)
			}
		}
		inputs[i] = in
	}

	ctx := c.Context()
	actor := actorFrom(c)
	if _, err := ensureCustomProviderRow(ctx, h.app, actor, slug); err != nil {
		return err
	}
	// Rows are collected and inserted in one transaction, so a failure part
	// way through stores nothing. seenKeys catches a key repeated inside the
	// file, which the stored-accounts check cannot see before the insert.
	accepted := make([]models.Account, 0, len(doc.Accounts))
	seenKeys := map[string]bool{}
	skipped := []accountsImportSkip{}
	for i, ba := range doc.Accounts {
		in := inputs[i]
		account := models.Account{
			ID:             uuid.NewString(),
			Provider:       slug,
			Label:          ba.Label,
			AuthKind:       ba.AuthKind,
			Priority:       ba.Priority,
			Disabled:       ba.Disabled,
			NeedsReconnect: ba.NeedsReconnect,
			Metadata:       orEmptyJSON(in.Metadata),
			TokenExpiresAt: ba.TokenExpiresAt,
		}
		if err := sealCredential(h.app, &account, in); err != nil {
			return err
		}
		dup := account.KeyHash != "" && seenKeys[account.KeyHash]
		if !dup {
			if dup, err = duplicateAccount(ctx, h.app, account, in); err != nil {
				return err
			}
		}
		if dup {
			skipped = append(skipped, accountsImportSkip{Label: ba.Label, Reason: "an account with this credential already exists"})
			continue
		}
		seenKeys[account.KeyHash] = true
		accepted = append(accepted, account)
	}
	if err := h.app.Repos.Accounts.BulkInsert(ctx, accepted); err != nil {
		return err
	}

	auditRecord(c, actor, "account.import", slug, map[string]int{"imported": len(accepted), "skipped": len(skipped)})
	return dtos.Item(c, fiber.StatusOK, fiber.Map{"imported": len(accepted), "skipped": skipped}, "Accounts imported")
}
