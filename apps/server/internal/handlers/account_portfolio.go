package handlers

import (
	"encoding/json"
	"fmt"
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
	ps, err := sealer.NewPortable(req.Passphrase)
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
	Passphrase string         `json:"passphrase"`
	Backup     accountsBackup `json:"backup"`
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
	doc := req.Backup
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
	if req.Passphrase == "" {
		return apperr.New(apperr.KindBadRequest, "enter the backup's passphrase to import it")
	}
	ps, err := sealer.OpenPortable(req.Passphrase, doc.Portable.Salt)
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
