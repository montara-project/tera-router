package repositories

import (
	"context"
	"time"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
)

// UserRepository manages dashboard accounts and their role join.
type UserRepository struct {
	BaseRepository
}

const userColumns = `
	u.id, u.fullname, u.email, u.phone, u.address, u.token_verify,
	u.password_hash, u.is_active, u.is_blocked, u.role_id,
	r.id AS role_id2, r.name AS role_name, r.created_at AS role_created_at, r.updated_at AS role_updated_at,
	u.created_at, u.updated_at, u.deleted_at,
	u.totp_wrapped_dek, u.totp_ciphertext, u.totp_last_step,
	COALESCE(u.oidc_iss, ''), COALESCE(u.oidc_sub, '')`

const userFrom = ` FROM users u JOIN roles r ON r.id = u.role_id`

func scanUser(row rowScanner) (models.User, error) {
	var (
		u   models.User
		rid string
	)
	err := row.Scan(
		&u.ID, &u.Fullname, &u.Email, &u.Phone, &u.Address, &u.TokenVerify,
		&u.PasswordHash, &u.IsActive, &u.IsBlocked, &u.RoleID,
		&rid, &u.Role.Name, &u.Role.CreatedAt, &u.Role.UpdatedAt,
		&u.CreatedAt, &u.UpdatedAt, &u.DeletedAt,
		&u.TOTPWrappedDEK, &u.TOTPCiphertext, &u.TOTPLastStep,
		&u.OIDCIss, &u.OIDCSub,
	)
	if err != nil {
		return models.User{}, translateNotFound(err)
	}
	u.Role.ID = rid
	u.TOTPEnabled = u.TOTPCiphertext != ""
	u.SSOLinked = u.OIDCSub != ""
	return u, nil
}

// GetByEmail resolves a live user by email.
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (models.User, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+userColumns+userFrom+` WHERE u.email = $1 AND u.deleted_at IS NULL`, email)
	return scanUser(row)
}

// GetByEmailFold resolves the single live user whose email matches
// case-insensitively — the shape identity providers expect, since the local
// part's case cannot be assumed. No match is ErrNotFound; several matches —
// pre-existing case variants, possible because the email unique index is
// case-sensitive — are a conflict rather than an arbitrary pick, so an
// ambiguous sign-in can never bind the wrong account.
func (r *UserRepository) GetByEmailFold(ctx context.Context, email string) (models.User, error) {
	rows, err := r.queryContext(ctx, r.DB, `SELECT`+userColumns+userFrom+` WHERE LOWER(u.email) = LOWER($1) AND u.deleted_at IS NULL`, email)
	if err != nil {
		return models.User{}, err
	}
	defer rows.Close()

	var out []models.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return models.User{}, err
		}
		out = append(out, u)
	}
	if err := rows.Err(); err != nil {
		return models.User{}, err
	}
	switch len(out) {
	case 0:
		return models.User{}, apperr.ErrNotFound
	case 1:
		return out[0], nil
	default:
		return models.User{}, apperr.New(apperr.KindConflict, "multiple accounts share this email")
	}
}

// GetByOIDCIdentity resolves a live user by its linked identity provider
// issuer and subject — the pair, since a sub is only unique within its
// issuer.
func (r *UserRepository) GetByOIDCIdentity(ctx context.Context, iss, sub string) (models.User, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+userColumns+userFrom+` WHERE u.oidc_iss = $1 AND u.oidc_sub = $2 AND u.deleted_at IS NULL`, iss, sub)
	return scanUser(row)
}

// RoleIDByName resolves a role's id by its unique name.
func (r *UserRepository) RoleIDByName(ctx context.Context, name string) (string, error) {
	var id string
	err := r.queryRowContext(ctx, r.DB, `SELECT id FROM roles WHERE name = $1`, name).Scan(&id)
	if err != nil {
		return "", translateNotFound(err)
	}
	return id, nil
}

// LinkOIDC binds an issuer-subject pair to the account, so later sign-ins
// match by the pair before email. The UPDATE only touches an unlinked row,
// so a racing callback cannot silently overwrite another identity: when no
// row changed, the stored pair is read back — the same pair reads as a
// successful idempotent link (healing a NULL issuer left by an earlier
// schema), anything else is a conflict.
func (r *UserRepository) LinkOIDC(ctx context.Context, id, iss, sub string) error {
	res, err := r.execContext(ctx, r.DB,
		`UPDATE users SET oidc_iss = $2, oidc_sub = $3,
		 updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		 WHERE id = $1 AND oidc_sub IS NULL AND deleted_at IS NULL`, id, iss, sub)
	if err != nil {
		return translateUnique(err, "OIDC subject already linked to another account")
	}
	if n, _ := res.RowsAffected(); n == 1 {
		return nil
	}
	var gotIss, gotSub string
	err = r.queryRowContext(ctx, r.DB,
		`SELECT COALESCE(oidc_iss, ''), COALESCE(oidc_sub, '') FROM users WHERE id = $1 AND deleted_at IS NULL`, id).
		Scan(&gotIss, &gotSub)
	if err != nil {
		return translateNotFound(err)
	}
	if gotSub != sub || (gotIss != "" && gotIss != iss) {
		return apperr.New(apperr.KindConflict, "account already linked to a different identity")
	}
	if gotIss == "" {
		_, err = r.execContext(ctx, r.DB, `UPDATE users SET oidc_iss = $2 WHERE id = $1 AND oidc_iss IS NULL`, id, iss)
		return err
	}
	return nil
}

// Insert creates a dashboard account. A conflicting email surfaces as a 409
// via translateUnique.
func (r *UserRepository) Insert(ctx context.Context, u models.User) error {
	return r.insertExec(ctx, r.DB, u)
}

// InsertIfEmailFree creates the account only when no live row folds-matches
// its email: the email unique index is case-sensitive, so a plain insert
// would let two concurrent sign-ins create "a@x" and "A@x" as separate
// accounts. Checking inside the INSERT keeps lookup and write atomic.
// inserted=false means a folded match already exists — the caller resolves
// that row; an error still covers a deleted row holding the exact email.
func (r *UserRepository) InsertIfEmailFree(ctx context.Context, u models.User) (inserted bool, err error) {
	res, err := r.execContext(ctx, r.DB,
		`INSERT INTO users (id, fullname, email, password_hash, is_active, is_blocked, role_id, oidc_iss, oidc_sub)
		 SELECT $1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), NULLIF($9, '')
		 WHERE NOT EXISTS (
			 SELECT 1 FROM users WHERE LOWER(email) = LOWER($3) AND deleted_at IS NULL)`,
		u.ID, u.Fullname, u.Email, u.PasswordHash, u.IsActive, u.IsBlocked, u.RoleID, u.OIDCIss, u.OIDCSub)
	if err != nil {
		return false, translateUnique(err, "email already registered")
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}

func (r *UserRepository) insertExec(ctx context.Context, ex Executor, u models.User) error {
	_, err := r.execContext(ctx, ex,
		`INSERT INTO users (id, fullname, email, password_hash, is_active, is_blocked, role_id, oidc_iss, oidc_sub)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), NULLIF($9, ''))`,
		u.ID, u.Fullname, u.Email, u.PasswordHash, u.IsActive, u.IsBlocked, u.RoleID, u.OIDCIss, u.OIDCSub)
	return translateUnique(err, "email already registered")
}

// Get resolves a live user by id.
func (r *UserRepository) Get(ctx context.Context, id string) (models.User, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+userColumns+userFrom+` WHERE u.id = $1 AND u.deleted_at IS NULL`, id)
	return scanUser(row)
}

// SetTOTP stores the sealed TOTP secret, enabling the second factor. lastStep
// is the step of the code that confirmed enrollment, so it cannot be reused.
func (r *UserRepository) SetTOTP(ctx context.Context, id, wrappedDEK, ciphertext string, lastStep int64) error {
	_, err := r.execContext(ctx, r.DB,
		`UPDATE users SET totp_wrapped_dek = $2, totp_ciphertext = $3, totp_last_step = $4,
		 updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, id, wrappedDEK, ciphertext, lastStep)
	return err
}

// ClearTOTP removes the TOTP secret, disabling the second factor.
func (r *UserRepository) ClearTOTP(ctx context.Context, id string) error {
	return r.SetTOTP(ctx, id, "", "", 0)
}

// ConsumeTOTPStep records step as used. It reports false when a code at this
// step or a later one was already accepted, which makes replay detection
// atomic across concurrent sign-ins.
func (r *UserRepository) ConsumeTOTPStep(ctx context.Context, id string, step int64) (bool, error) {
	res, err := r.execContext(ctx, r.DB,
		`UPDATE users SET totp_last_step = $2 WHERE id = $1 AND totp_last_step < $2`, id, step)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// RevokeSessions refuses every access token issued to the user before now.
// Refresh tokens are revoked separately (RefreshTokenRepository).
//
// The time comes from Go, truncated to milliseconds like a token's iat, not
// from SQLite's clock, which can round up: a token issued in the same
// millisecond right after the revocation must stay valid.
func (r *UserRepository) RevokeSessions(ctx context.Context, id string) error {
	at := time.Now().UTC().Truncate(time.Millisecond).Format("2006-01-02 15:04:05.000-07:00")
	_, err := r.execContext(ctx, r.DB, `UPDATE users SET sessions_revoked_at = $2 WHERE id = $1`, id, at)
	return err
}

// AuthState is what RequireAuth checks per request: whether the account may
// still sign in, and when its sessions were last revoked.
func (r *UserRepository) AuthState(ctx context.Context, id string) (usable bool, revokedAt *time.Time, err error) {
	var active, blocked bool
	err = r.queryRowContext(ctx, r.DB,
		`SELECT is_active, is_blocked, sessions_revoked_at FROM users WHERE id = $1 AND deleted_at IS NULL`, id).
		Scan(&active, &blocked, &revokedAt)
	if err != nil {
		return false, nil, translateNotFound(err)
	}
	return active && !blocked, revokedAt, nil
}
