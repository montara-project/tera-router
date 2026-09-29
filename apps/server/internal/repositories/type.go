package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"tera-router/server/internal/lib/apperr"

	"braces.dev/errtrace"
)

// Executor is the statement surface shared by *sql.DB and *sql.Tx. Every
// repository helper takes one, so the same code runs either on the pooled
// connection or inside an open transaction.
type Executor interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// rowScanner is the scan surface shared by *sql.Row and *sql.Rows, so a single
// scan function serves both single-row and multi-row reads.
type rowScanner interface {
	Scan(dest ...any) error
}

type QueryOptions struct {
	Offset int64
	Limit  int64

	OrderBy string
	Order   string // asc | desc
}

type PaginationMetadata struct {
	Total int64 `json:"total"`
}

// buildOrderBy resolves the ORDER BY column and direction from user-supplied
// options. Both the default and the resolved OrderBy are bare column names
// (matching allowedColumns keys); the caller owns identifier quoting and any
// table qualification, so never pass a pre-quoted default. Order is
// case-insensitively matched to ASC/DESC.
func buildOrderBy(opts *QueryOptions, allowedColumns map[string]bool, defaultOrderBy string) (string, string, error) {
	orderBy := defaultOrderBy
	order := "DESC"

	if opts.OrderBy != "" {
		if !allowedColumns[opts.OrderBy] {
			return "", "", errtrace.New("invalid order by column")
		}
		orderBy = opts.OrderBy
	}

	if opts.Order != "" {
		upperOrder := strings.ToUpper(opts.Order)
		if upperOrder != "ASC" && upperOrder != "DESC" {
			return "", "", errtrace.New("invalid order")
		}
		order = upperOrder
	}

	return orderBy, order, nil
}

// withTx runs fn inside a transaction, committing when fn returns nil and
// rolling back otherwise. fn receives the transaction as an Executor, so
// multi-statement writes reuse the repository's *Exec helpers and the same SQL
// runs standalone or atomically. The BEGIN/COMMIT/ROLLBACK boundaries are
// logged too, so a debug trace shows exactly which statements shared a
// transaction.
func (r BaseRepository) withTx(ctx context.Context, fn func(tx Executor) error) error {
	r.debugQuery("BEGIN")
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return errtrace.Wrap(err)
	}

	finished := false
	defer func() {
		if !finished {
			r.debugQuery("ROLLBACK")
			_ = tx.Rollback()
		}
	}()

	if err := fn(tx); err != nil {
		return err
	}

	r.debugQuery("COMMIT")
	err = tx.Commit()
	// The transaction is over either way, so never roll back after this.
	finished = true

	return errtrace.Wrap(err)
}

// requireAffected turns a write that touched no row into apperr.ErrNotFound,
// so callers can tell "updated nothing" apart from a successful write.
func requireAffected(res sql.Result, what string) error {
	n, err := res.RowsAffected()
	if err != nil {
		return errtrace.Wrap(err)
	}
	if n == 0 {
		return fmt.Errorf("%w: %s", apperr.ErrNotFound, what)
	}
	return nil
}
