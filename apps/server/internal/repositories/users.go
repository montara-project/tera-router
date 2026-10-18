package repositories

import (
	"context"

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
	u.totp_wrapped_dek, u.totp_ciphertext, u.totp_last_step`

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
	)
	if err != nil {
		return models.User{}, translateNotFound(err)
	}
	u.Role.ID = rid
	u.TOTPEnabled = u.TOTPCiphertext != ""
	return u, nil
}

// Insert persists a new user.
func (r *UserRepository) Insert(ctx context.Context, u models.User) error {
	return r.insertExec(ctx, u)
}

func (r *UserRepository) insertExec(ctx context.Context, u models.User) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO users (id, fullname, email, phone, address, token_verify, password_hash, is_active, is_blocked, role_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		u.ID, u.Fullname, u.Email, u.Phone, u.Address, u.TokenVerify, u.PasswordHash, u.IsActive, u.IsBlocked, u.RoleID,
	)
	return err
}

// GetByEmail resolves a live user by email.
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (models.User, error) {
	return r.getByEmailExec(ctx, email)
}

func (r *UserRepository) getByEmailExec(ctx context.Context, email string) (models.User, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+userColumns+userFrom+` WHERE u.email = $1 AND u.deleted_at IS NULL`, email)
	return scanUser(row)
}

// Get resolves a live user by id.
func (r *UserRepository) Get(ctx context.Context, id string) (models.User, error) {
	return r.getExec(ctx, id)
}

func (r *UserRepository) getExec(ctx context.Context, id string) (models.User, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT`+userColumns+userFrom+` WHERE u.id = $1 AND u.deleted_at IS NULL`, id)
	return scanUser(row)
}

// UpdatePassword rewrites the stored password hash.
func (r *UserRepository) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	return r.updatePasswordExec(ctx, id, passwordHash)
}

func (r *UserRepository) updatePasswordExec(ctx context.Context, id, passwordHash string) error {
	_, err := r.execContext(ctx, r.DB,
		`UPDATE users SET password_hash = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, id, passwordHash)
	return err
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
