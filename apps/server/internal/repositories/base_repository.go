package repositories

import (
	"context"
	"database/sql"
	"log/slog"

	"tera-router/server/internal/config"

	"braces.dev/errtrace"
	"github.com/maxrichie5/go-sqlfmt/sqlfmt"
)

// BaseRepository is embedded by every repository. It carries the shared
// connection pool and the debug config, and funnels every statement through
// the helpers below so that debug logging cannot be bypassed by a repository
// calling the driver directly.
type BaseRepository struct {
	DB     *sql.DB
	Config *config.ConfigApp
}

// debugQuery logs the pretty-printed SQL and its bind arguments when debug
// mode is enabled (--debug / DEBUG=true). Every execution helper calls it, so
// enabling debug traces the whole SQL surface of the process.
func (r BaseRepository) debugQuery(query string, args ...any) {
	if r.Config == nil || !r.Config.Debug {
		return
	}
	slog.Debug("query", "sql", sqlfmt.PrettyFormat(query), "args", args)
}

// execContext runs a write statement against ex — the pool or an open
// transaction — after logging it.
func (r BaseRepository) execContext(ctx context.Context, ex Executor, query string, args ...any) (sql.Result, error) {
	r.debugQuery(query, args...)
	res, err := ex.ExecContext(ctx, query, args...)
	return res, errtrace.Wrap(err)
}

// queryContext runs a read statement against ex after logging it.
func (r BaseRepository) queryContext(ctx context.Context, ex Executor, query string, args ...any) (*sql.Rows, error) {
	r.debugQuery(query, args...)
	rows, err := ex.QueryContext(ctx, query, args...)
	return rows, errtrace.Wrap(err)
}

// queryRowContext runs a single-row read against ex after logging it. A miss
// surfaces at Scan as sql.ErrNoRows, which translateNotFound maps onto
// apperr.ErrNotFound.
func (r BaseRepository) queryRowContext(ctx context.Context, ex Executor, query string, args ...any) *sql.Row {
	r.debugQuery(query, args...)
	return ex.QueryRowContext(ctx, query, args...)
}
