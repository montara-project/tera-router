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
	// The precheck in the create handler cannot see a concurrent insert; the
	// unique index on key_hash turns that race into the same conflict.
	return translateUnique(err, "an account with this key already exists")
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

// AccountFilter narrows an accounts page. Empty fields match everything.
// Search is a case-insensitive substring of the label or the key fingerprint,
// the two things the dashboard shows for an account.
type AccountFilter struct {
	Provider string
	AuthKind string
	Search   string
}

// List returns a page of accounts newest-first plus the filtered total.
func (r *AccountRepository) List(ctx context.Context, f AccountFilter, offset, limit int) ([]models.Account, int, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT`+accountColumns+`, count(*) OVER () AS total
		FROM accounts
		WHERE ($1 = '' OR provider = $1)
		AND ($2 = '' OR auth_kind = $2)
		AND ($3 = '' OR instr(lower(label || ' ' || key_fingerprint), lower($3)) > 0)
		ORDER BY created_at DESC
		LIMIT $5 OFFSET $4`, f.Provider, f.AuthKind, f.Search, offset, limit)
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

// ListUsable returns every account of a provider that can serve traffic:
// enabled (not disabled) and not awaiting re-authentication, ordered by
// priority then creation time. The gateway uses it to plan routing attempts.
func (r *AccountRepository) ListUsable(ctx context.Context, provider string) ([]models.Account, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT`+accountColumns+`
		FROM accounts
		WHERE provider = $1 AND disabled = false AND needs_reconnect = false
		ORDER BY priority ASC, created_at ASC`, provider)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []models.Account{}
	for rows.Next() {
		a, err := scanAccount(rows)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, a)
	}
	return accounts, errtrace.Wrap(rows.Err())
}

// Get returns one account by id.
func (r *AccountRepository) Get(ctx context.Context, id string) (models.Account, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+accountColumns+` FROM accounts WHERE id = $1`, id)
	return scanAccount(row)
}

// GetByKeyHash locates a duplicate credential by its sha-256 key hash.
func (r *AccountRepository) GetByKeyHash(ctx context.Context, keyHash string) (models.Account, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+accountColumns+` FROM accounts WHERE key_hash = $1`, keyHash)
	return scanAccount(row)
}

// Update rewrites an account row. Callers that only mean to change part of
// it should prefer the scoped variants below: a whole-row write copies the
// caller's stale snapshot over any column a concurrent writer just changed.
func (r *AccountRepository) Update(ctx context.Context, a models.Account) error {
	res, err := r.execContext(ctx, r.DB, `
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
		// Re-sealing to a credential another account already owns is the same
		// conflict a duplicate create hits.
		return translateUnique(err, "an account with this key already exists")
	}
	return requireAffected(res, "account")
}

// UpdateProfile rewrites only the operator-editable columns. A PATCH that
// carries no new credential material uses this so it cannot roll back token
// blobs a background OAuth refresh sealed after the row was read.
func (r *AccountRepository) UpdateProfile(ctx context.Context, a models.Account) error {
	res, err := r.execContext(ctx, r.DB, `
		UPDATE accounts
		SET label = $2, auth_kind = $3, metadata = $4, priority = $5,
		    disabled = $6, proxy_pool_id = $7, needs_reconnect = $8,
		    updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		a.ID, a.Label, a.AuthKind, a.Metadata, a.Priority, a.Disabled, a.ProxyPoolID, a.NeedsReconnect,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "account")
}

// UpdateTokens persists a refreshed OAuth grant: only the token and refresh
// blobs plus the new expiry. The refresh spans a provider round trip, so the
// snapshot behind it is seconds old — touching operator columns here would
// silently undo any PATCH that landed in the meantime.
func (r *AccountRepository) UpdateTokens(ctx context.Context, a models.Account) error {
	res, err := r.execContext(ctx, r.DB, `
		UPDATE accounts
		SET token_wrapped_dek = $2, token_ciphertext = $3,
		    refresh_wrapped_dek = $4, refresh_ciphertext = $5, token_expires_at = $6,
		    updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		a.ID, a.Token.WrappedDEK, a.Token.Ciphertext,
		a.Refresh.WrappedDEK, a.Refresh.Ciphertext, a.TokenExpiresAt,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "account")
}

// SetDisabled flips the disabled flag of one account.
func (r *AccountRepository) SetDisabled(ctx context.Context, id string, disabled bool) error {
	res, err := r.execContext(ctx, r.DB,
		`UPDATE accounts SET disabled = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, id, disabled)
	if err != nil {
		return err
	}
	return requireAffected(res, "account")
}

// SetNeedsReconnect flags an OAuth account whose refresh token is dead, so the
// dashboard surfaces it for re-authentication.
func (r *AccountRepository) SetNeedsReconnect(ctx context.Context, id string, needs bool) error {
	res, err := r.execContext(ctx, r.DB,
		`UPDATE accounts SET needs_reconnect = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, id, needs)
	if err != nil {
		return err
	}
	return requireAffected(res, "account")
}

// ListByProvider returns every account of one provider — including disabled
// and needs-reconnect rows — so OAuth connect can dedup against them.
func (r *AccountRepository) ListByProvider(ctx context.Context, provider string) ([]models.Account, error) {
	rows, err := r.queryContext(ctx, r.DB,
		`SELECT`+accountColumns+` FROM accounts WHERE provider = $1 ORDER BY created_at ASC`, provider)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []models.Account{}
	for rows.Next() {
		a, err := scanAccount(rows)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, a)
	}
	return accounts, errtrace.Wrap(rows.Err())
}

// Delete removes one account.
func (r *AccountRepository) Delete(ctx context.Context, id string) error {
	res, err := r.execContext(ctx, r.DB, `DELETE FROM accounts WHERE id = $1`, id)
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
	res, err := r.execContext(ctx, r.DB, query, args...)
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
	res, err := r.execContext(ctx, r.DB, query, args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// SetDisabledByProvider flips every account of a provider.
func (r *AccountRepository) SetDisabledByProvider(ctx context.Context, providerSlug string, disabled bool) (int64, error) {
	res, err := r.execContext(ctx, r.DB,
		`UPDATE accounts SET disabled = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE provider = $1`, providerSlug, disabled)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// CountByProvider returns how many enabled+disabled accounts each provider
// has, for the providers overview.
func (r *AccountRepository) CountByProvider(ctx context.Context) (map[string]int, error) {
	return r.countGrouped(ctx, `SELECT provider, count(*) FROM accounts GROUP BY provider`)
}

// CountUsableByProvider returns how many accounts each provider has that can
// serve traffic — the same filter as ListUsable.
func (r *AccountRepository) CountUsableByProvider(ctx context.Context) (map[string]int, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT provider, count(*) FROM accounts
		WHERE disabled = false AND needs_reconnect = false
		GROUP BY provider`)
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

// CountByProxyPool returns how many accounts route through each proxy pool.
func (r *AccountRepository) CountByProxyPool(ctx context.Context) (map[string]int, error) {
	return r.countGrouped(ctx, `SELECT proxy_pool_id, count(*) FROM accounts WHERE proxy_pool_id IS NOT NULL GROUP BY proxy_pool_id`)
}

// countGrouped runs a "key, count" query into a map.
func (r *AccountRepository) countGrouped(ctx context.Context, query string) (map[string]int, error) {
	rows, err := r.queryContext(ctx, r.DB, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var key string
		var n int
		if err := rows.Scan(&key, &n); err != nil {
			return nil, errtrace.Wrap(err)
		}
		counts[key] = n
	}
	return counts, errtrace.Wrap(rows.Err())
}
