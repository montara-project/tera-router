package repositories

import (
	"context"
	"database/sql"
	"time"

	"tera-router/server/internal/models"
)

// RefreshTokenRepository manages hashed refresh tokens.
type RefreshTokenRepository struct {
	BaseRepository
}

// Insert persists a new refresh token.
func (r *RefreshTokenRepository) Insert(ctx context.Context, t models.RefreshToken) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		t.ID, t.UserID, t.TokenHash, t.UserAgent, t.IPAddress, t.ExpiresAt,
	)
	return err
}

// GetValid returns the token row when it exists, is unrevoked, and unexpired.
func (r *RefreshTokenRepository) GetValid(ctx context.Context, tokenHash string) (models.RefreshToken, error) {
	row := r.queryRowContext(ctx, r.DB, `
		SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
		FROM refresh_tokens
		WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`, tokenHash)

	var t models.RefreshToken
	err := row.Scan(&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.RevokedAt, &t.CreatedAt)
	return t, translateNotFound(err)
}

// Rotate swaps the session's token for a new one, keeping its id. It matches
// the old hash too, so of two refreshes racing on one token only the first
// wins; the other gets ErrNotFound.
func (r *RefreshTokenRepository) Rotate(ctx context.Context, id, oldHash, newHash string, expiresAt time.Time) error {
	res, err := r.execContext(ctx, r.DB, `
		UPDATE refresh_tokens SET token_hash = $3, expires_at = $4
		WHERE id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
		id, oldHash, newHash, expiresAt)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return translateNotFound(sql.ErrNoRows)
	}
	return nil
}

// ListActive returns the user's unrevoked, unexpired sessions, newest first.
func (r *RefreshTokenRepository) ListActive(ctx context.Context, userID string) ([]models.RefreshToken, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT id, user_id, user_agent, ip_address, expires_at, created_at
		FROM refresh_tokens
		WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.RefreshToken{}
	for rows.Next() {
		var t models.RefreshToken
		if err := rows.Scan(&t.ID, &t.UserID, &t.UserAgent, &t.IPAddress, &t.ExpiresAt, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// IsActive reports whether the session is still unrevoked. Expiry is not
// checked: the refresh TTL outlives every access token signed for it.
func (r *RefreshTokenRepository) IsActive(ctx context.Context, id string) (bool, error) {
	var ok bool
	err := r.queryRowContext(ctx, r.DB,
		`SELECT EXISTS (SELECT 1 FROM refresh_tokens WHERE id = $1 AND revoked_at IS NULL)`, id).Scan(&ok)
	return ok, err
}

// RevokeForUser ends one of the user's live sessions; ErrNotFound when the
// session is not theirs or already ended.
func (r *RefreshTokenRepository) RevokeForUser(ctx context.Context, id, userID string) error {
	res, err := r.execContext(ctx, r.DB,
		`UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`, id, userID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return translateNotFound(sql.ErrNoRows)
	}
	return nil
}

// RevokeAllForUser invalidates every live refresh token of a user (sign-out
// everywhere, password change).
func (r *RefreshTokenRepository) RevokeAllForUser(ctx context.Context, userID string) error {
	_, err := r.execContext(ctx, r.DB,
		`UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	return err
}
