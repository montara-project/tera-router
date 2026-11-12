package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"

	"braces.dev/errtrace"
	"modernc.org/sqlite"
)

// BackupRow is one table row keyed by column name, as carried by the JSON
// configuration backup.
type BackupRow = map[string]any

// BackupRepository moves whole tables in and out of the database for the
// configuration backup, and snapshots/restores the SQLite file itself.
//
// Table names are never taken from user input: callers pass a fixed list,
// and column names are intersected with PRAGMA table_info before they reach
// SQL, so a crafted backup cannot inject identifiers.
type BackupRepository struct {
	BaseRepository
}

type backupColumn struct {
	name     string
	datetime bool
}

func (r *BackupRepository) columnsExec(ctx context.Context, ex Executor, table string) ([]backupColumn, error) {
	rows, err := r.queryContext(ctx, ex, fmt.Sprintf(`SELECT name, type FROM pragma_table_info('%s')`, table))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []backupColumn
	for rows.Next() {
		var name, typ string
		if err := rows.Scan(&name, &typ); err != nil {
			return nil, errtrace.Wrap(err)
		}
		cols = append(cols, backupColumn{name: name, datetime: strings.EqualFold(typ, "DATETIME")})
	}
	if err := rows.Err(); err != nil {
		return nil, errtrace.Wrap(err)
	}
	if len(cols) == 0 {
		return nil, fmt.Errorf("backup: unknown table %q", table)
	}
	return cols, nil
}

// Dump reads every row of each table, skipping the omitted columns. Values
// keep their driver types (time.Time renders as RFC 3339 in JSON).
func (r *BackupRepository) Dump(ctx context.Context, tables []string, omit map[string][]string) (map[string][]BackupRow, error) {
	out := make(map[string][]BackupRow, len(tables))
	for _, table := range tables {
		cols, err := r.columnsExec(ctx, r.DB, table)
		if err != nil {
			return nil, err
		}
		selected := make([]string, 0, len(cols))
		for _, c := range cols {
			if !containsString(omit[table], c.name) {
				selected = append(selected, c.name)
			}
		}

		rows, err := r.queryContext(ctx, r.DB, fmt.Sprintf(`SELECT "%s" FROM "%s" ORDER BY rowid`, strings.Join(selected, `", "`), table))
		if err != nil {
			return nil, err
		}
		list := []BackupRow{}
		for rows.Next() {
			vals := make([]any, len(selected))
			ptrs := make([]any, len(selected))
			for i := range vals {
				ptrs[i] = &vals[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				rows.Close()
				return nil, errtrace.Wrap(err)
			}
			row := make(BackupRow, len(selected))
			for i, name := range selected {
				if b, ok := vals[i].([]byte); ok {
					row[name] = string(b)
				} else {
					row[name] = vals[i]
				}
			}
			list = append(list, row)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, errtrace.Wrap(err)
		}
		out[table] = list
	}
	return out, nil
}

// Replace wipes the given tables and inserts the backup rows in one
// transaction. Tables are inserted in the given order (parents first) and
// deleted in reverse. Row keys that are not columns of the current schema
// are ignored, and missing columns take their defaults, so a backup from an
// older schema still restores. Returns the inserted row count per table.
func (r *BackupRepository) Replace(ctx context.Context, tables []string, data map[string][]BackupRow) (map[string]int, error) {
	counts := make(map[string]int, len(tables))
	err := r.withTx(ctx, func(tx Executor) error {
		for i := len(tables) - 1; i >= 0; i-- {
			if _, err := r.execContext(ctx, tx, fmt.Sprintf(`DELETE FROM "%s"`, tables[i])); err != nil {
				return err
			}
		}
		for _, table := range tables {
			cols, err := r.columnsExec(ctx, tx, table)
			if err != nil {
				return err
			}
			for n, row := range data[table] {
				names := make([]string, 0, len(row))
				args := make([]any, 0, len(row))
				for _, c := range cols {
					v, ok := row[c.name]
					if !ok {
						continue
					}
					names = append(names, c.name)
					args = append(args, backupValue(v, c.datetime))
				}
				if len(names) == 0 {
					continue
				}
				placeholders := strings.TrimSuffix(strings.Repeat("?, ", len(names)), ", ")
				query := fmt.Sprintf(`INSERT INTO "%s" ("%s") VALUES (%s)`, table, strings.Join(names, `", "`), placeholders)
				if _, err := r.execContext(ctx, tx, query, args...); err != nil {
					return apperr.New(apperr.KindUnprocessable, "%s row %d: %s", table, n+1, err.Error())
				}
				counts[table]++
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return counts, nil
}

// backupValue converts a JSON-decoded value into a driver argument: numbers
// decoded with UseNumber become int64/float64, and DATETIME strings become
// time.Time so the driver writes them in the database's own text format.
func backupValue(v any, datetime bool) any {
	switch t := v.(type) {
	case json.Number:
		if i, err := t.Int64(); err == nil {
			return i
		}
		f, _ := t.Float64()
		return f
	case string:
		if datetime {
			if ts, err := time.Parse(time.RFC3339Nano, t); err == nil {
				return ts
			}
		}
		return t
	case map[string]any, []any:
		raw, _ := json.Marshal(t)
		return string(raw)
	}
	return v
}

func containsString(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// VacuumInto writes a compacted, transactionally consistent copy of the live
// database to path, which must not exist yet.
func (r *BackupRepository) VacuumInto(ctx context.Context, path string) error {
	_, err := r.execContext(ctx, r.DB, `VACUUM INTO ?`, path)
	return err
}

// SchemaVersion reports the golang-migrate version of the live database.
func (r *BackupRepository) SchemaVersion(ctx context.Context) (int64, error) {
	return SchemaVersionOf(ctx, r.DB)
}

// SchemaVersionOf reads the golang-migrate version of any database handle,
// rejecting a database left dirty by a failed migration.
func SchemaVersionOf(ctx context.Context, db *sql.DB) (int64, error) {
	var (
		version int64
		dirty   bool
	)
	err := db.QueryRowContext(ctx, `SELECT version, dirty FROM schema_migrations LIMIT 1`).Scan(&version, &dirty)
	if err != nil {
		return 0, errtrace.Wrap(err)
	}
	if dirty {
		return 0, fmt.Errorf("schema version %d is dirty", version)
	}
	return version, nil
}

// restorer is the online-backup surface of a modernc.org/sqlite connection.
type restorer interface {
	NewRestore(srcURI string) (*sqlite.Backup, error)
}

// RestoreFrom overwrites the live database, page by page, with the SQLite
// file at srcPath using SQLite's online backup API. Every pooled connection
// sees the restored content afterwards; no reopen is needed.
func (r *BackupRepository) RestoreFrom(ctx context.Context, srcPath string) error {
	conn, err := r.DB.Conn(ctx)
	if err != nil {
		return errtrace.Wrap(err)
	}
	defer conn.Close()

	return errtrace.Wrap(conn.Raw(func(driverConn any) error {
		rc, ok := driverConn.(restorer)
		if !ok {
			return errors.New("restore: driver does not support the online backup API")
		}
		bk, err := rc.NewRestore(srcPath)
		if err != nil {
			return err
		}
		for {
			more, err := bk.Step(-1)
			if err != nil {
				_ = bk.Finish()
				return err
			}
			if !more {
				break
			}
		}
		return bk.Finish()
	}))
}

// SealedColumns lists, per table, the envelope-sealed secret prefixes
// (<prefix>_wrapped_dek + <prefix>_ciphertext). A secret's sealer purpose is
// "<table>.<prefix>". A portable configuration backup replaces each pair with
// <prefix>_portable.
var SealedColumns = map[string][]string{
	"accounts": {"secret", "token", "refresh"},
	"api_keys": {"secret"},
	"users":    {"totp"},
}

// EachSealed calls fn for every stored secret in db with its row id and
// purpose. A table or column the database's schema does not have yet (an
// older backup) holds no secrets and is skipped.
func EachSealed(ctx context.Context, db *sql.DB, fn func(table, prefix, id string, s sealer.Sealed) error) error {
	type secret struct {
		table, prefix, id string
		sealed            sealer.Sealed
	}
	// Collected before fn runs, so fn may write to the rows it is handed.
	var found []secret
	for table, prefixes := range SealedColumns {
		for _, prefix := range prefixes {
			rows, err := db.QueryContext(ctx, fmt.Sprintf(
				`SELECT id, %[2]s_wrapped_dek, %[2]s_ciphertext FROM %[1]s WHERE %[2]s_ciphertext <> ''`, table, prefix))
			if err != nil {
				if strings.Contains(err.Error(), "no such") {
					continue
				}
				return errtrace.Wrap(err)
			}
			for rows.Next() {
				s := secret{table: table, prefix: prefix}
				if err := rows.Scan(&s.id, &s.sealed.WrappedDEK, &s.sealed.Ciphertext); err != nil {
					_ = rows.Close()
					return errtrace.Wrap(err)
				}
				found = append(found, s)
			}
			if err := rows.Err(); err != nil {
				_ = rows.Close()
				return errtrace.Wrap(err)
			}
			if err := rows.Close(); err != nil {
				return errtrace.Wrap(err)
			}
		}
	}
	for _, s := range found {
		if err := fn(s.table, s.prefix, s.id, s.sealed); err != nil {
			return err
		}
	}
	return nil
}

// ResealLegacy binds every secret sealed before purposes existed to its
// column and returns how many it rewrote. It runs on boot and after a restore
// brings older rows in; secrets it cannot open at all are left as they are.
//
// before, when set, runs once ahead of the first rewrite and aborts the pass
// on error: a release that predates purposes cannot open a rewritten secret,
// so boot takes a copy of the database to roll back to.
func ResealLegacy(ctx context.Context, db *sql.DB, secrets *sealer.Sealer, before func() error) (int, error) {
	type rewrite struct {
		table, prefix, id string
		old, bound        sealer.Sealed
	}
	var pending []rewrite
	err := EachSealed(ctx, db, func(table, prefix, id string, s sealer.Sealed) error {
		if bound, changed, err := secrets.Reseal(s, table+"."+prefix); err == nil && changed {
			pending = append(pending, rewrite{table, prefix, id, s, bound})
		}
		return nil
	})
	if err != nil || len(pending) == 0 {
		return 0, err
	}
	if before != nil {
		if err := before(); err != nil {
			return 0, err
		}
	}
	for _, w := range pending {
		// Only while the row still holds what was read: a token refreshed in
		// the meantime is already bound and must not be put back.
		if _, err := db.ExecContext(ctx, fmt.Sprintf(
			`UPDATE %[1]s SET %[2]s_wrapped_dek = $1, %[2]s_ciphertext = $2 WHERE id = $3 AND %[2]s_ciphertext = $4`, w.table, w.prefix),
			w.bound.WrappedDEK, w.bound.Ciphertext, w.id, w.old.Ciphertext); err != nil {
			return 0, errtrace.Wrap(err)
		}
	}
	return len(pending), nil
}
