// Package database opens the SQLite connection pool shared by cmd/api and
// cmd/migrate.
package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"time"

	_ "modernc.org/sqlite"
)

// DefaultPath is the database file used when no path is configured.
const DefaultPath = "terarouter.db"

// Open opens (creating if missing) the SQLite database at path and verifies
// it is reachable.
//
// Every pooled connection is configured through the DSN so the settings hold
// for all of them, not only the first:
//   - foreign_keys: enforce REFERENCES / ON DELETE CASCADE (off by default).
//   - journal_mode=WAL + synchronous=NORMAL: concurrent readers alongside the
//     single writer, durable across application crashes.
//   - busy_timeout: wait on a locked database instead of failing with
//     SQLITE_BUSY.
//   - _txlock=immediate: write transactions take the write lock at BEGIN, so
//     two transactions cannot deadlock upgrading from read to write.
//   - _time_format=sqlite + _timezone=UTC: time.Time is written as
//     "YYYY-MM-DD HH:MM:SS.fff+00:00", matching the column defaults, so
//     timestamps compare correctly as text.
func Open(path string) (*sql.DB, error) {
	if path == "" {
		return nil, errors.New("database path is required")
	}

	q := url.Values{}
	q.Add("_pragma", "foreign_keys(1)")
	q.Add("_pragma", "journal_mode(WAL)")
	q.Add("_pragma", "synchronous(NORMAL)")
	q.Add("_pragma", "busy_timeout(5000)")
	q.Set("_txlock", "immediate")
	q.Set("_time_format", "sqlite")
	q.Set("_timezone", "UTC")

	db, err := sql.Open("sqlite", "file:"+path+"?"+q.Encode())
	if err != nil {
		return nil, fmt.Errorf("open sqlite %s: %w", path, err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping sqlite %s: %w", path, err)
	}

	return db, nil
}
