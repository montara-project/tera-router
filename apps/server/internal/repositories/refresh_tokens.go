package repositories

import (
	"context"

	"tera-router/server/internal/models"
)

// RefreshTokenRepository manages hashed refresh tokens.
type RefreshTokenRepository struct {
	BaseRepository
}

// Insert persists a new refresh token.
func (r *RefreshTokenRepository) Insert(ctx context.Context, t models.RefreshToken) error {
	return r.insertExec(ctx, r.DB, t)
}

func (r *RefreshTokenRepository) insertExec(ctx context.Context, ex Executor, t models.RefreshToken) error {
	_, err := r.execContext(ctx, ex, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)`,
		t.ID, t.UserID, t.TokenHash, t.ExpiresAt,
	)
	return err
}

// GetValid returns the token row when it exists, is unrevoked, and unexpired.
func (r *RefreshTokenRepository) GetValid(ctx context.Context, tokenHash string) (models.RefreshToken, error) {
	return r.getValidExec(ctx, r.DB, tokenHash)
}

func (r *RefreshTokenRepository) getValidExec(ctx context.Context, ex Executor, tokenHash string) (models.RefreshToken, error) {
	row := r.queryRowContext(ctx, ex, `
		SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
		FROM refresh_tokens
		WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`, tokenHash)

	var t models.RefreshToken
	err := row.Scan(&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.RevokedAt, &t.CreatedAt)
	return t, translateNotFound(err)
}

// Revoke invalidates one live refresh token.
func (r *RefreshTokenRepository) Revoke(ctx context.Context, id string) error {
	return r.revokeExec(ctx, r.DB, id)
}

func (r *RefreshTokenRepository) revokeExec(ctx context.Context, ex Executor, id string) error {
	_, err := r.execContext(ctx, ex,
		`UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1 AND revoked_at IS NULL`, id)
	return err
}

// RevokeAllForUser invalidates every live refresh token of a user (sign-out
// everywhere, password change).
func (r *RefreshTokenRepository) RevokeAllForUser(ctx context.Context, userID string) error {
	return r.revokeAllForUserExec(ctx, r.DB, userID)
}

func (r *RefreshTokenRepository) revokeAllForUserExec(ctx context.Context, ex Executor, userID string) error {
	_, err := r.execContext(ctx, ex,
		`UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	return err
}
