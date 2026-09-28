package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"tera-router/server/internal/config"

	"braces.dev/errtrace"
	"github.com/google/uuid"
	"github.com/maxrichie5/go-sqlfmt/sqlfmt"
)

type BaseRepository struct {
	DB        *sql.DB
	TableName string
	Config    *config.ConfigApp
	// SoftDelete marks tables that carry a "deleted_at" column, so row counts
	// can exclude soft-deleted rows.
	SoftDelete bool
}

func (r BaseRepository) debugQuery(query string) {
	if r.Config == nil || !r.Config.Debug {
		return
	}
	slog.Debug("query", "sql", sqlfmt.PrettyFormat(query))
}

// tableName validates the configured table name. The exec helpers build SQL
// from TableName, so an empty value would produce an invalid query
// (FROM "") — fail with an explicit error instead.
func (r BaseRepository) tableName() (string, error) {
	if r.TableName == "" {
		return "", errtrace.New("repository table name is not configured")
	}

	return r.TableName, nil
}

func (r BaseRepository) countExec(exc Executor) (int64, error) {
	tableName, err := r.tableName()
	if err != nil {
		return 0, err
	}

	query := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM "%s";
	`, tableName)

	if r.SoftDelete {
		query = fmt.Sprintf(`
		SELECT COUNT(*)
		FROM "%s"
		WHERE "deleted_at" IS NULL;
		`, tableName)
	}

	r.debugQuery(query)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	row := exc.QueryRowContext(ctx, query)
	if row == nil {
		return 0, errtrace.New("error scanning row: no next row")
	}

	var count int64
	if err := row.Scan(&count); err != nil {
		return 0, errtrace.Errorf("error scanning row: %w", err)
	}

	return count, nil
}

func (r BaseRepository) deleteExec(exc Executor, id uuid.UUID) error {
	tableName, err := r.tableName()
	if err != nil {
		return err
	}

	query := fmt.Sprintf(`
		DELETE FROM "%s"
		WHERE "id" = $1;
	`, tableName)

	r.debugQuery(query)

	args := []any{id}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
	if err != nil {
		return errtrace.Wrap(err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrRecordNotFound
	}

	return nil
}

func (r BaseRepository) softDeleteExec(exc Executor, id uuid.UUID) error {
	tableName, err := r.tableName()
	if err != nil {
		return err
	}

	query := fmt.Sprintf(`
		UPDATE "%s"
		SET "deleted_at" = strftime('%%Y-%%m-%%d %%H:%%M:%%f+00:00', 'now')
		WHERE "id" = $1;
	`, tableName)

	r.debugQuery(query)

	args := []any{id}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
	if err != nil {
		return errtrace.Wrap(err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrRecordNotFound
	}

	return nil
}

func (r BaseRepository) restoreExec(exc Executor, id uuid.UUID) error {
	tableName, err := r.tableName()
	if err != nil {
		return err
	}

	query := fmt.Sprintf(`
		UPDATE "%s"
		SET "deleted_at" = NULL
		WHERE "id" = $1;
	`, tableName)

	r.debugQuery(query)

	args := []any{id}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := exc.ExecContext(ctx, query, args...)
	if err != nil {
		return errtrace.Wrap(err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrRecordNotFound
	}

	return nil
}
