package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

// PasskeyRepository stores WebAuthn passkeys.
type PasskeyRepository struct {
	BaseRepository
}

const passkeyColumns = `id, user_id, credential_id, rp_id, name, credential, last_used_at, created_at`

func scanPasskey(row interface{ Scan(...any) error }) (models.Passkey, error) {
	var p models.Passkey
	err := row.Scan(&p.ID, &p.UserID, &p.CredentialID, &p.RPID, &p.Name, &p.Credential, &p.LastUsedAt, &p.CreatedAt)
	return p, err
}

// ListForUser returns the user's passkeys, newest first.
func (r *PasskeyRepository) ListForUser(ctx context.Context, userID string) ([]models.Passkey, error) {
	rows, err := r.queryContext(ctx, r.DB,
		`SELECT `+passkeyColumns+` FROM passkeys WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Passkey{}
	for rows.Next() {
		p, err := scanPasskey(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// GetByCredentialID looks a passkey up by its base64url WebAuthn credential id.
func (r *PasskeyRepository) GetByCredentialID(ctx context.Context, credentialID string) (models.Passkey, error) {
	p, err := scanPasskey(r.queryRowContext(ctx, r.DB,
		`SELECT `+passkeyColumns+` FROM passkeys WHERE credential_id = $1`, credentialID))
	return p, translateNotFound(err)
}

// Insert persists a new passkey.
func (r *PasskeyRepository) Insert(ctx context.Context, p models.Passkey) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO passkeys (id, user_id, credential_id, rp_id, name, credential)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		p.ID, p.UserID, p.CredentialID, p.RPID, p.Name, p.Credential)
	return translateUnique(err, "passkey already registered")
}

// MarkUsed stores the credential record a sign-in updated (sign count,
// flags) and stamps last_used_at.
func (r *PasskeyRepository) MarkUsed(ctx context.Context, id, credential string) error {
	_, err := r.execContext(ctx, r.DB, `
		UPDATE passkeys SET credential = $2, last_used_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`, id, credential)
	return err
}

// DeleteForUser removes one of the user's passkeys; ErrNotFound when it is
// not theirs.
func (r *PasskeyRepository) DeleteForUser(ctx context.Context, id, userID string) error {
	res, err := r.execContext(ctx, r.DB, `DELETE FROM passkeys WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return translateNotFound(sql.ErrNoRows)
	}
	return nil
}
