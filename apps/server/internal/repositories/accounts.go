package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

type AccountRepository struct {
	db *sql.DB
}

const accountColumns = `
	id, provider, label, auth_kind,
	secret_wrapped_dek, secret_ciphertext, key_fingerprint, key_hash,
	token_wrapped_dek, token_ciphertext, refresh_wrapped_dek, refresh_ciphertext,
	token_expires_at, metadata, priority, disabled, proxy_pool_id, needs_reconnect,
	created_at, updated_at`

func scanAccount(row interface{ Scan(...any) error }) (models.Account, error) {
	var a models.Account
	err := row.Scan(
		&a.ID, &a.Provider, &a.Label, &a.AuthKind,
		&a.Secret.WrappedDEK, &a.Secret.Ciphertext, &a.KeyFingerprint, &a.KeyHash,
		&a.Token.WrappedDEK, &a.Token.Ciphertext, &a.Refresh.WrappedDEK, &a.Refresh.Ciphertext,
		&a.TokenExpiresAt, &a.Metadata, &a.Priority, &a.Disabled, &a.ProxyPoolID, &a.NeedsReconnect,
		&a.CreatedAt, &a.UpdatedAt,
	)
	return a, translateNotFound(err)
}

const accountInsert = `
	INSERT INTO accounts (id, provider, label, auth_kind,
		secret_wrapped_dek, secret_ciphertext, key_fingerprint, key_hash,
		token_wrapped_dek, token_ciphertext, refresh_wrapped_dek, refresh_ciphertext,
		token_expires_at, metadata, priority, disabled, proxy_pool_id, needs_reconnect)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18)`

func insertAccount(ctx context.Context, exec interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}, a models.Account) error {
	_, err := exec.ExecContext(ctx, accountInsert,
		a.ID, a.Provider, a.Label, a.AuthKind,
		a.Secret.WrappedDEK, a.Secret.Ciphertext, a.KeyFingerprint, a.KeyHash,
		a.Token.WrappedDEK, a.Token.Ciphertext, a.Refresh.WrappedDEK, a.Refresh.Ciphertext,
		a.TokenExpiresAt, a.Metadata, a.Priority, a.Disabled, a.ProxyPoolID, a.NeedsReconnect,
	)
	return err
}

func (r *AccountRepository) Create(ctx context.Context, a models.Account) error {
	return insertAccount(ctx, r.db, a)
}

// BulkCreate inserts many accounts in a single transaction, aborting on the
// first failure.
func (r *AccountRepository) BulkCreate(ctx context.Context, accounts []models.Account) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, a := range accounts {
		if err := insertAccount(ctx, tx, a); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *AccountRepository) List(ctx context.Context, offset, limit int) ([]models.Account, int, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT`+accountColumns+`, count(*) OVER () AS total
		FROM accounts
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $1`, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	accounts := []models.Account{}
	total := 0
	for rows.Next() {
		var a models.Account
		var totalRows int
		if err := rows.Scan(
			&a.ID, &a.Provider, &a.Label, &a.AuthKind,
			&a.Secret.WrappedDEK, &a.Secret.Ciphertext, &a.KeyFingerprint, &a.KeyHash,
			&a.Token.WrappedDEK, &a.Token.Ciphertext, &a.Refresh.WrappedDEK, &a.Refresh.Ciphertext,
			&a.TokenExpiresAt, &a.Metadata, &a.Priority, &a.Disabled, &a.ProxyPoolID, &a.NeedsReconnect,
			&a.CreatedAt, &a.UpdatedAt, &totalRows,
		); err != nil {
			return nil, 0, err
		}
		total = totalRows
		accounts = append(accounts, a)
	}
	return accounts, total, rows.Err()
}

func (r *AccountRepository) FindByID(ctx context.Context, id string) (models.Account, error) {
	row := r.db.QueryRowContext(ctx, `SELECT`+accountColumns+` FROM accounts WHERE id = $1`, id)
	return scanAccount(row)
}

// FindByKeyHash locates a duplicate credential by its sha-256 key hash.
func (r *AccountRepository) FindByKeyHash(ctx context.Context, keyHash string) (models.Account, error) {
	row := r.db.QueryRowContext(ctx, `SELECT`+accountColumns+` FROM accounts WHERE key_hash = $1`, keyHash)
	return scanAccount(row)
}

func (r *AccountRepository) Update(ctx context.Context, a models.Account) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE accounts
		SET label = $2, auth_kind = $3,
		    secret_wrapped_dek = $4, secret_ciphertext = $5, key_fingerprint = $6, key_hash = $7,
		    token_wrapped_dek = $8, token_ciphertext = $9,
		    refresh_wrapped_dek = $10, refresh_ciphertext = $11,
		    token_expires_at = $12, metadata = $13::jsonb, priority = $14, disabled = $15,
		    proxy_pool_id = $16, needs_reconnect = $17, updated_at = now()
		WHERE id = $1`,
		a.ID, a.Label, a.AuthKind,
		a.Secret.WrappedDEK, a.Secret.Ciphertext, a.KeyFingerprint, a.KeyHash,
		a.Token.WrappedDEK, a.Token.Ciphertext,
		a.Refresh.WrappedDEK, a.Refresh.Ciphertext,
		a.TokenExpiresAt, a.Metadata, a.Priority, a.Disabled, a.ProxyPoolID, a.NeedsReconnect,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "account")
}

func (r *AccountRepository) SetDisabled(ctx context.Context, id string, disabled bool) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE accounts SET disabled = $2, updated_at = now() WHERE id = $1`, id, disabled)
	if err != nil {
		return err
	}
	return requireAffected(res, "account")
}

func (r *AccountRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM accounts WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "account")
}

// DeleteDisabled removes every disabled account for a provider (or all
// providers when providerSlug is empty), returning the number removed.
func (r *AccountRepository) DeleteDisabled(ctx context.Context, providerSlug string) (int64, error) {
	query := `DELETE FROM accounts WHERE disabled = true`
	args := []any{}
	if providerSlug != "" {
		query += ` AND provider = $1`
		args = append(args, providerSlug)
	}
	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// DeleteAll removes every account for a provider (or all providers when the
// slug is empty), returning the number removed.
func (r *AccountRepository) DeleteAll(ctx context.Context, providerSlug string) (int64, error) {
	query := `DELETE FROM accounts`
	args := []any{}
	if providerSlug != "" {
		query += ` WHERE provider = $1`
		args = append(args, providerSlug)
	}
	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// SetDisabledByProvider flips every account of a provider.
func (r *AccountRepository) SetDisabledByProvider(ctx context.Context, providerSlug string, disabled bool) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`UPDATE accounts SET disabled = $2, updated_at = now() WHERE provider = $1`, providerSlug, disabled)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// CountByProvider returns how many enabled+disabled accounts each provider
// has, for the providers overview.
func (r *AccountRepository) CountByProvider(ctx context.Context) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT provider, count(*) FROM accounts GROUP BY provider`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var provider string
		var n int
		if err := rows.Scan(&provider, &n); err != nil {
			return nil, err
		}
		counts[provider] = n
	}
	return counts, rows.Err()
}
