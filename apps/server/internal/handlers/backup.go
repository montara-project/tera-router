package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/database"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

type backupHandler struct {
	app *app.Application
}

// configBackupFormat identifies a Tera Router configuration backup document.
const (
	configBackupFormat  = "tera-router.config"
	configBackupVersion = 1
	// portableCheck is sealed into every portable backup so a wrong
	// passphrase is rejected before any credential is touched.
	portableCheck = "tera-router"
)

// configTables are the configuration tables a backup carries, parents
// before children (restore inserts in this order and deletes in reverse).
// Users, sessions, usage history and the audit log are deliberately left out:
// they are operational state, not configuration.
var configTables = []string{
	"settings",
	"custom_providers",
	"plans",
	"proxy_pools",
	"accounts",
	"api_keys",
	"chains",
	"chain_steps",
	"model_aliases",
	"alias_targets",
	"budgets",
	"guardrail_policies",
	"model_pricing_overrides",
	"model_capability_overrides",
	"skills",
}

// configOmit drops columns that only make sense on the source install:
// api_keys.user_id references a users row the backup does not carry.
var configOmit = map[string][]string{
	"api_keys": {"user_id"},
}

// sealedColumns lists, per table, the envelope-sealed secret prefixes
// (<prefix>_wrapped_dek + <prefix>_ciphertext). A portable backup replaces
// each pair with <prefix>_portable.
var sealedColumns = map[string][]string{
	"accounts": {"secret", "token", "refresh"},
	"api_keys": {"secret"},
}

type portableHeader struct {
	KDF   string `json:"kdf"`
	Salt  string `json:"salt"`
	Check string `json:"check"`
}

type configBackup struct {
	Format     string                              `json:"format"`
	Version    int                                 `json:"version"`
	AppVersion string                              `json:"app_version"`
	ExportedAt time.Time                           `json:"exported_at"`
	Portable   *portableHeader                     `json:"portable"`
	Tables     map[string][]repositories.BackupRow `json:"tables"`
}

// ConfigExport renders every configuration table as one JSON document. With
// a passphrase the credentials are re-keyed so the file imports on any
// install; without one they stay sealed under this install's APP_SECRET.
func (h *backupHandler) ConfigExport(c fiber.Ctx) error {
	var req dtos.ConfigExport
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	ctx := c.Context()

	tables, err := h.app.Repos.Backup.Dump(ctx, configTables, configOmit)
	if err != nil {
		return err
	}

	doc := configBackup{
		Format:     configBackupFormat,
		Version:    configBackupVersion,
		AppVersion: app.Version,
		ExportedAt: time.Now().UTC(),
		Tables:     tables,
	}

	if req.Passphrase != "" {
		ps, err := sealer.NewPortable(req.Passphrase)
		if err != nil {
			return err
		}
		check, err := ps.Seal(portableCheck)
		if err != nil {
			return err
		}
		doc.Portable = &portableHeader{KDF: "argon2id", Salt: ps.Salt(), Check: check}
		if err := h.rekeyForExport(tables, ps); err != nil {
			return err
		}
	}

	raw, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return err
	}
	auditRecord(ctx, h.app, actorFrom(c), "backup.config.export", configBackupFormat, map[string]bool{"portable": doc.Portable != nil})

	c.Attachment(fmt.Sprintf("tera-router-config-%s.json", time.Now().UTC().Format("20060102-150405")))
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSONCharsetUTF8)
	return c.Send(raw)
}

// rekeyForExport opens every sealed credential with the master key and
// re-seals it under the portable key, blanking the master-key blobs.
func (h *backupHandler) rekeyForExport(tables map[string][]repositories.BackupRow, ps *sealer.PortableSealer) error {
	for table, prefixes := range sealedColumns {
		for _, row := range tables[table] {
			for _, p := range prefixes {
				sealed := sealedFrom(row, p)
				if sealed.Empty() {
					continue
				}
				plain, err := h.app.Secrets.OpenString(sealed)
				if err != nil {
					return apperr.New(apperr.KindInternal, "cannot open %s credential of %s %v: %s", p, table, row["id"], err.Error())
				}
				ct, err := ps.Seal(plain)
				if err != nil {
					return err
				}
				row[p+"_portable"] = ct
				row[p+"_wrapped_dek"] = ""
				row[p+"_ciphertext"] = ""
			}
		}
	}
	return nil
}

func sealedFrom(row repositories.BackupRow, prefix string) sealer.Sealed {
	dek, _ := row[prefix+"_wrapped_dek"].(string)
	ct, _ := row[prefix+"_ciphertext"].(string)
	return sealer.Sealed{WrappedDEK: dek, Ciphertext: ct}
}

type configImportRequest struct {
	Passphrase string       `json:"passphrase"`
	Backup     configBackup `json:"backup"`
}

// ConfigImport restores a configuration backup: every table present in the
// document replaces the live table in one transaction, after a safety copy of
// the database file is written next to it.
func (h *backupHandler) ConfigImport(c fiber.Ctx) error {
	var req configImportRequest
	dec := json.NewDecoder(bytes.NewReader(c.Body()))
	dec.UseNumber()
	if err := dec.Decode(&req); err != nil {
		return apperr.New(apperr.KindBadRequest, "invalid backup JSON: %s", err.Error())
	}
	doc := req.Backup
	if doc.Format != configBackupFormat {
		return apperr.New(apperr.KindUnprocessable, "not a Tera Router configuration backup")
	}
	if doc.Version < 1 || doc.Version > configBackupVersion {
		return apperr.New(apperr.KindUnprocessable, "unsupported configuration backup version %d", doc.Version)
	}
	ctx := c.Context()

	if err := h.rekeyForImport(doc, req.Passphrase); err != nil {
		return err
	}

	tables := make([]string, 0, len(configTables))
	for _, t := range configTables {
		if _, ok := doc.Tables[t]; ok {
			tables = append(tables, t)
		}
	}
	if len(tables) == 0 {
		return apperr.New(apperr.KindUnprocessable, "the backup contains no configuration tables")
	}

	safety, err := h.safetyCopy(ctx, "pre-import")
	if err != nil {
		return err
	}
	counts, err := h.app.Repos.Backup.Replace(ctx, tables, doc.Tables)
	if err != nil {
		return err
	}
	auditRecord(ctx, h.app, actorFrom(c), "backup.config.import", configBackupFormat, map[string]any{"tables": counts, "portable": doc.Portable != nil})
	return dtos.Item(c, fiber.StatusOK, fiber.Map{"tables": counts, "safety_copy": safety}, "Configuration imported")
}

// rekeyForImport makes every credential in the document openable by this
// install: portable secrets are opened with the passphrase and sealed under
// the master key; master-key blobs are verified to belong to this
// APP_SECRET, so a non-portable backup from another install fails loudly
// instead of restoring credentials nothing can decrypt.
func (h *backupHandler) rekeyForImport(doc configBackup, passphrase string) error {
	var ps *sealer.PortableSealer
	if doc.Portable != nil {
		if passphrase == "" {
			return apperr.New(apperr.KindBadRequest, "this backup is portable: enter its passphrase to import it")
		}
		var err error
		if ps, err = sealer.OpenPortable(passphrase, doc.Portable.Salt); err != nil {
			return apperr.New(apperr.KindUnprocessable, "corrupt portable backup header")
		}
		if got, err := ps.Open(doc.Portable.Check); err != nil || got != portableCheck {
			return apperr.New(apperr.KindBadRequest, "wrong passphrase")
		}
	}

	for table, prefixes := range sealedColumns {
		for _, row := range doc.Tables[table] {
			for _, p := range prefixes {
				if ps != nil {
					ct, _ := row[p+"_portable"].(string)
					delete(row, p+"_portable")
					if ct == "" {
						continue
					}
					plain, err := ps.Open(ct)
					if err != nil {
						return apperr.New(apperr.KindUnprocessable, "cannot decrypt %s credential of %s %v", p, table, row["id"])
					}
					sealed, err := h.app.Secrets.SealString(plain)
					if err != nil {
						return err
					}
					row[p+"_wrapped_dek"] = sealed.WrappedDEK
					row[p+"_ciphertext"] = sealed.Ciphertext
					continue
				}
				sealed := sealedFrom(row, p)
				if sealed.Empty() {
					continue
				}
				if _, err := h.app.Secrets.Open(sealed); err != nil {
					return apperr.New(apperr.KindUnprocessable, "the backup's credentials were sealed with a different APP_SECRET; export it again with a passphrase (portable mode)")
				}
			}
		}
	}
	return nil
}

// DatabaseInfo describes the live database file.
func (h *backupHandler) DatabaseInfo(c fiber.Ctx) error {
	path, err := filepath.Abs(h.app.Config.Database.Path)
	if err != nil {
		return err
	}
	var size int64
	for _, p := range []string{path, path + "-wal"} {
		if st, err := os.Stat(p); err == nil {
			size += st.Size()
		}
	}
	version, err := h.app.Repos.Backup.SchemaVersion(c.Context())
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"driver":         "sqlite",
		"path":           path,
		"size_bytes":     size,
		"schema_version": version,
	})
}

// DatabaseDownload streams a consistent VACUUM INTO snapshot of the live
// database.
func (h *backupHandler) DatabaseDownload(c fiber.Ctx) error {
	ctx := c.Context()
	tmp := h.siblingPath(fmt.Sprintf("export-%d.db", time.Now().UnixNano()))
	if err := h.app.Repos.Backup.VacuumInto(ctx, tmp); err != nil {
		return err
	}
	f, err := os.Open(tmp)
	// Unlink right away: the open descriptor keeps the snapshot readable
	// until the response stream closes it, and nothing is left behind.
	_ = os.Remove(tmp)
	if err != nil {
		return err
	}
	st, err := f.Stat()
	if err != nil {
		_ = f.Close()
		return err
	}
	auditRecord(ctx, h.app, actorFrom(c), "backup.database.download", filepath.Base(h.app.Config.Database.Path), map[string]int64{"size_bytes": st.Size()})

	c.Attachment(fmt.Sprintf("terarouter-%s.db", time.Now().UTC().Format("20060102-150405")))
	c.Set(fiber.HeaderContentType, "application/vnd.sqlite3")
	return c.SendStream(f, int(st.Size()))
}

// DatabaseRestore replaces the live database with an uploaded SQLite file
// (multipart field "file"). The upload must pass an integrity check and carry
// a Tera Router schema no newer than this server's; a safety copy of the
// current database is written first, and an older schema is migrated up
// after the restore.
func (h *backupHandler) DatabaseRestore(c fiber.Ctx) error {
	fh, err := c.FormFile("file")
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "upload the .db file in the multipart field \"file\"")
	}
	ctx := c.Context()

	tmp := h.siblingPath(fmt.Sprintf("restore-%d.db", time.Now().UnixNano()))
	defer func() {
		for _, p := range []string{tmp, tmp + "-wal", tmp + "-shm"} {
			_ = os.Remove(p)
		}
	}()
	if err := saveUpload(fh, tmp); err != nil {
		return err
	}

	version, err := inspectDatabase(ctx, tmp)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "not a valid Tera Router database: %s", err.Error())
	}
	live, err := h.app.Repos.Backup.SchemaVersion(ctx)
	if err != nil {
		return err
	}
	if version > live {
		return apperr.New(apperr.KindUnprocessable, "the backup's schema (v%d) is newer than this server's (v%d); upgrade Tera Router first", version, live)
	}

	safety, err := h.safetyCopy(ctx, "pre-restore")
	if err != nil {
		return err
	}
	if err := h.app.Repos.Backup.RestoreFrom(ctx, tmp); err != nil {
		return apperr.New(apperr.KindInternal, "restore failed (safety copy at %s): %s", safety, err.Error())
	}
	if version < live {
		if err := migrator.Up(h.app.DB, migrator.DefaultDir); err != nil {
			return apperr.New(apperr.KindInternal, "restored, but migrating v%d → v%d failed (safety copy at %s): %s", version, live, safety, err.Error())
		}
	}

	auditRecord(ctx, h.app, actorFrom(c), "backup.database.restore", fh.Filename, map[string]any{"from_schema": version, "safety_copy": safety})
	return dtos.Item(c, fiber.StatusOK, fiber.Map{"schema_version": live, "restored_schema_version": version, "safety_copy": safety}, "Database restored")
}

func saveUpload(fh *multipart.FileHeader, dst string) error {
	src, err := fh.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, src); err != nil {
		_ = out.Close()
		return err
	}
	return out.Close()
}

// inspectDatabase opens an uploaded file as SQLite, checks its integrity and
// that it carries the Tera Router schema, and returns its schema version.
func inspectDatabase(ctx context.Context, path string) (int64, error) {
	db, err := database.Open(path)
	if err != nil {
		return 0, errors.New("the file is not a SQLite database")
	}
	defer db.Close()

	var result string
	if err := db.QueryRowContext(ctx, `PRAGMA integrity_check`).Scan(&result); err != nil {
		return 0, err
	}
	if result != "ok" {
		return 0, fmt.Errorf("integrity check failed: %s", result)
	}
	var tables int
	if err := db.QueryRowContext(ctx, `
		SELECT count(*) FROM sqlite_master
		WHERE type = 'table' AND name IN ('schema_migrations', 'settings', 'accounts', 'api_keys')`).Scan(&tables); err != nil {
		return 0, err
	}
	if tables != 4 {
		return 0, errors.New("the Tera Router tables are missing")
	}
	return repositories.SchemaVersionOf(ctx, db)
}

// siblingPath names a scratch file next to the live database, so snapshots
// land on the same (persistent, writable) volume.
func (h *backupHandler) siblingPath(suffix string) string {
	path := h.app.Config.Database.Path
	return filepath.Join(filepath.Dir(path), "."+strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))+"."+suffix)
}

// safetyCopy snapshots the live database next to it before a destructive
// import and returns the copy's path.
func (h *backupHandler) safetyCopy(ctx context.Context, label string) (string, error) {
	path := h.app.Config.Database.Path
	dst := filepath.Join(filepath.Dir(path), fmt.Sprintf("%s.%s-%s.bak", filepath.Base(path), label, time.Now().UTC().Format("20060102-150405")))
	if err := h.app.Repos.Backup.VacuumInto(ctx, dst); err != nil {
		return "", fmt.Errorf("write safety copy: %w", err)
	}
	return filepath.Abs(dst)
}
