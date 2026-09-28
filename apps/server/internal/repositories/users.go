package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

type UserRepository struct {
	db *sql.DB
}

const userColumns = `
	u.id, u.fullname, u.email, u.phone, u.address, u.token_verify,
	u.password_hash, u.is_active, u.is_blocked, u.role_id,
	r.id AS role_id2, r.name AS role_name, r.created_at AS role_created_at, r.updated_at AS role_updated_at,
	u.created_at, u.updated_at, u.deleted_at`

const userFrom = ` FROM users u JOIN roles r ON r.id = u.role_id`

func scanUser(row interface{ Scan(...any) error }) (models.User, error) {
	var (
		u   models.User
		rid string
	)
	err := row.Scan(
		&u.ID, &u.Fullname, &u.Email, &u.Phone, &u.Address, &u.TokenVerify,
		&u.PasswordHash, &u.IsActive, &u.IsBlocked, &u.RoleID,
		&rid, &u.Role.Name, &u.Role.CreatedAt, &u.Role.UpdatedAt,
		&u.CreatedAt, &u.UpdatedAt, &u.DeletedAt,
	)
	if err != nil {
		return models.User{}, translateNotFound(err)
	}
	u.Role.ID = rid
	return u, nil
}

func (r *UserRepository) Create(ctx context.Context, u models.User) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO users (id, fullname, email, phone, address, token_verify, password_hash, is_active, is_blocked, role_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		u.ID, u.Fullname, u.Email, u.Phone, u.Address, u.TokenVerify, u.PasswordHash, u.IsActive, u.IsBlocked, u.RoleID,
	)
	return err
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (models.User, error) {
	row := r.db.QueryRowContext(ctx, `SELECT`+userColumns+userFrom+` WHERE u.email = $1 AND u.deleted_at IS NULL`, email)
	return scanUser(row)
}

func (r *UserRepository) FindByID(ctx context.Context, id string) (models.User, error) {
	row := r.db.QueryRowContext(ctx, `SELECT`+userColumns+userFrom+` WHERE u.id = $1 AND u.deleted_at IS NULL`, id)
	return scanUser(row)
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET password_hash = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, id, passwordHash)
	return err
}
