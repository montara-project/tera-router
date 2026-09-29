package repositories

import (
	"context"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// AccountRepository manages upstream provider credentials (sealed API keys
// and OAuth tokens).
type AccountRepository struct {
	BaseRepository
}

const accountColumns = `
	id, provider, label, auth_kind,
	secret_wrapped_dek, secret_ciphertext, key_fingerprint, key_hash,
	token_wrapped_dek, token_ciphertext, refresh_wrapped_dek, refresh_ciphertext,
	token_expires_at, metadata, priority, disabled, proxy_pool_id, needs_reconnect,
	created_at, updated_at`

func scanAccount(row rowScanner) (models.Account, error) {
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
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`

// Insert persists a new account on the pooled connection.
func (r *AccountRepository) Insert(ctx context.Context, a models.Account) error {
	return r.insertExec(ctx, r.DB, a)
}

func (r *AccountRepository) insertExec(ctx context.Context, ex Executor, a models.Account) error {
	_, err := r.execContext(ctx, ex, accountInsert,
		a.ID, a.Provider, a.Label, a.AuthKind,
		a.Secret.WrappedDEK, a.Secret.Ciphertext, a.KeyFingerprint, a.KeyHash,
		a.Token.WrappedDEK, a.Token.Ciphertext, a.Refresh.WrappedDEK, a.Refresh.Ciphertext,
		a.TokenExpiresAt, a.Metadata, a.Priority, a.Disabled, a.ProxyPoolID, a.NeedsReconnect,
	)
	return err
}

// BulkInsert inserts many accounts in a single transaction, aborting on the
// first failure.
func (r *AccountRepository) BulkInsert(ctx context.Context, accounts []models.Account) error {
	return r.withTx(ctx, func(tx Executor) error {
		for _, a := range accounts {
			if err := r.insertExec(ctx, tx, a); err != nil {
				return err
			}
		}
		return nil
	})
}

// List returns a page of accounts newest-first plus the unpaged total.
func (r *AccountRepository) List(ctx context.Context, offset, limit int) ([]models.Account, int, error) {
	return r.listExec(ctx, r.DB, offset, limit)
}

func (r *AccountRepository) listExec(ctx context.Context, ex Executor, offset, limit int) ([]models.Account, int, error) {
	rows, err := r.queryContext(ctx, ex, `
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
			return nil, 0, errtrace.Wrap(err)
		}
		total = totalRows
		accounts = append(accounts, a)
	}
	return accounts, total, errtrace.Wrap(rows.Err())
}

// Get returns one account by id.
func (r *AccountRepository) Get(ctx context.Context, id string) (models.Account, error) {
	return r.getExec(ctx, r.DB, id)
}

func (r *AccountRepository) getExec(ctx context.Context, ex Executor, id string) (models.Account, error) {
	row := r.queryRowContext(ctx, ex, `SELECT`+accountColumns+` FROM accounts WHERE id = $1`, id)
	return scanAccount(row)
}

// GetByKeyHash locates a duplicate credential by its sha-256 key hash.
func (r *AccountRepository) GetByKeyHash(ctx context.Context, keyHash string) (models.Account, error) {
	return r.getByKeyHashExec(ctx, r.DB, keyHash)
}

func (r *AccountRepository) getByKeyHashExec(ctx context.Context, ex Executor, keyHash string) (models.Account, error) {
	row := r.queryRowContext(ctx, ex, `SELECT`+accountColumns+` FROM accounts WHERE key_hash = $1`, keyHash)
	return scanAccount(row)
}

// Update rewrites an account row.
func (r *AccountRepository) Update(ctx context.Context, a models.Account) error {
	return r.updateExec(ctx, r.DB, a)
}

func (r *AccountRepository) updateExec(ctx context.Context, ex Executor, a models.Account) error {
	res, err := r.execContext(ctx, ex, `
		UPDATE accounts
		SET label = $2, auth_kind = $3,
		    secret_wrapped_dek = $4, secret_ciphertext = $5, key_fingerprint = $6, key_hash = $7,
		    token_wrapped_dek = $8, token_ciphertext = $9,
		    refresh_wrapped_dek = $10, refresh_ciphertext = $11,
		    token_expires_at = $12, metadata = $13, priority = $14, disabled = $15,
		    proxy_pool_id = $16, needs_reconnect = $17, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
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

// SetDisabled flips the disabled flag of one account.
func (r *AccountRepository) SetDisabled(ctx context.Context, id string, disabled bool) error {
	return r.setDisabledExec(ctx, r.DB, id, disabled)
}

func (r *AccountRepository) setDisabledExec(ctx context.Context, ex Executor, id string, disabled bool) error {
	res, err := r.execContext(ctx, ex,
		`UPDATE accounts SET disabled = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, id, disabled)
	if err != nil {
		return err
	}
	return requireAffected(res, "account")
}

// Delete removes one account.
func (r *AccountRepository) Delete(ctx context.Context, id string) error {
	return r.deleteExec(ctx, r.DB, id)
}

func (r *AccountRepository) deleteExec(ctx context.Context, ex Executor, id string) error {
	res, err := r.execContext(ctx, ex, `DELETE FROM accounts WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "account")
}

// DeleteDisabled removes every disabled account for a provider (or all
// providers when providerSlug is empty), returning the number removed.
func (r *AccountRepository) DeleteDisabled(ctx context.Context, providerSlug string) (int64, error) {
	return r.deleteDisabledExec(ctx, r.DB, providerSlug)
}

func (r *AccountRepository) deleteDisabledExec(ctx context.Context, ex Executor, providerSlug string) (int64, error) {
	query := `DELETE FROM accounts WHERE disabled = true`
	args := []any{}
	if providerSlug != "" {
		query += ` AND provider = $1`
		args = append(args, providerSlug)
	}
	res, err := r.execContext(ctx, ex, query, args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// DeleteAll removes every account for a provider (or all providers when the
// slug is empty), returning the number removed.
func (r *AccountRepository) DeleteAll(ctx context.Context, providerSlug string) (int64, error) {
	return r.deleteAllExec(ctx, r.DB, providerSlug)
}

func (r *AccountRepository) deleteAllExec(ctx context.Context, ex Executor, providerSlug string) (int64, error) {
	query := `DELETE FROM accounts`
	args := []any{}
	if providerSlug != "" {
		query += ` WHERE provider = $1`
		args = append(args, providerSlug)
	}
	res, err := r.execContext(ctx, ex, query, args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// SetDisabledByProvider flips every account of a provider.
func (r *AccountRepository) SetDisabledByProvider(ctx context.Context, providerSlug string, disabled bool) (int64, error) {
	return r.setDisabledByProviderExec(ctx, r.DB, providerSlug, disabled)
}

func (r *AccountRepository) setDisabledByProviderExec(ctx context.Context, ex Executor, providerSlug string, disabled bool) (int64, error) {
	res, err := r.execContext(ctx, ex,
		`UPDATE accounts SET disabled = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE provider = $1`, providerSlug, disabled)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// CountByProvider returns how many enabled+disabled accounts each provider
// has, for the providers overview.
func (r *AccountRepository) CountByProvider(ctx context.Context) (map[string]int, error) {
	return r.countByProviderExec(ctx, r.DB)
}

func (r *AccountRepository) countByProviderExec(ctx context.Context, ex Executor) (map[string]int, error) {
	rows, err := r.queryContext(ctx, ex, `SELECT provider, count(*) FROM accounts GROUP BY provider`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var provider string
		var n int
		if err := rows.Scan(&provider, &n); err != nil {
			return nil, errtrace.Wrap(err)
		}
		counts[provider] = n
	}
	return counts, errtrace.Wrap(rows.Err())
}
