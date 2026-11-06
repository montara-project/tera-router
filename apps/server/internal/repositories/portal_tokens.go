package repositories

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"

	"braces.dev/errtrace"
)

// PortalTokenRepository stores the usage-portal link token of each API key.
// The token is kept in plain text so the dashboard can copy the same link
// again; it only grants read access to that key's usage.
type PortalTokenRepository struct {
	BaseRepository
}

// ForKey returns the key's portal token, or "" when it has none.
func (r *PortalTokenRepository) ForKey(ctx context.Context, keyID string) (string, error) {
	var token string
	err := r.queryRowContext(ctx, r.DB,
		`SELECT token FROM api_key_portal_tokens WHERE api_key_id = $1`, keyID).Scan(&token)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return token, errtrace.Wrap(err)
}

// Issue gives the key a new portal token, replacing any previous one so old
// links stop working.
func (r *PortalTokenRepository) Issue(ctx context.Context, keyID string) (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", errtrace.Wrap(err)
	}
	token := "pt_" + base64.RawURLEncoding.EncodeToString(buf)
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO api_key_portal_tokens (api_key_id, token) VALUES ($1, $2)
		ON CONFLICT (api_key_id) DO UPDATE SET token = excluded.token,
		    created_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`, keyID, token)
	return token, err
}

// Revoke removes the key's portal token. Revoking a key without one is a no-op.
func (r *PortalTokenRepository) Revoke(ctx context.Context, keyID string) error {
	_, err := r.execContext(ctx, r.DB, `DELETE FROM api_key_portal_tokens WHERE api_key_id = $1`, keyID)
	return err
}

// KeyID resolves a portal token to its API key id. An unknown token surfaces
// as the repository's not-found error.
func (r *PortalTokenRepository) KeyID(ctx context.Context, token string) (string, error) {
	var keyID string
	err := r.queryRowContext(ctx, r.DB,
		`SELECT api_key_id FROM api_key_portal_tokens WHERE token = $1`, token).Scan(&keyID)
	return keyID, translateNotFound(err)
}
