package repositories

import (
	"context"
	"database/sql"
	"time"

	"tera-router/server/internal/models"
)

type APIKeyRepository struct {
	db *sql.DB
}

// APIKeyWithPlan is a key joined with its bound plan for listing.
type APIKeyWithPlan struct {
	models.APIKey
	PlanName *string
	PlanNote *string
}

func (r *APIKeyRepository) Create(ctx context.Context, k models.APIKey) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO api_keys (id, user_id, plan_id, name, key_hash, lookup_hash, display, scopes, disabled, secret_wrapped_dek, secret_ciphertext)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		k.ID, k.UserID, k.PlanID, k.Name, k.KeyHash, k.LookupHash, k.Display, k.Scopes, k.Disabled,
		k.Secret.WrappedDEK, k.Secret.Ciphertext,
	)
	return err
}

func (r *APIKeyRepository) List(ctx context.Context, offset, limit int) ([]APIKeyWithPlan, int, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT k.id, k.user_id, k.plan_id, k.name, k.display, k.scopes, k.disabled, k.last_used_at,
		       k.secret_wrapped_dek, k.secret_ciphertext, k.created_at, k.updated_at,
		       p.name, p.description,
		       count(*) OVER () AS total
		FROM api_keys k
		LEFT JOIN plans p ON p.id = k.plan_id
		ORDER BY k.created_at DESC
		LIMIT $2 OFFSET $1`, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	keys := []APIKeyWithPlan{}
	total := 0
	for rows.Next() {
		var (
			k         APIKeyWithPlan
			totalRows int
		)
		if err := rows.Scan(
			&k.ID, &k.UserID, &k.PlanID, &k.Name, &k.Display, &k.Scopes, &k.Disabled, &k.LastUsedAt,
			&k.Secret.WrappedDEK, &k.Secret.Ciphertext, &k.CreatedAt, &k.UpdatedAt,
			&k.PlanName, &k.PlanNote, &totalRows,
		); err != nil {
			return nil, 0, err
		}
		total = totalRows
		keys = append(keys, k)
	}
	return keys, total, rows.Err()
}

func (r *APIKeyRepository) FindByID(ctx context.Context, id string) (models.APIKey, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, user_id, plan_id, name, key_hash, lookup_hash, display, scopes, disabled, last_used_at,
		       secret_wrapped_dek, secret_ciphertext, created_at, updated_at
		FROM api_keys WHERE id = $1`, id)

	var k models.APIKey
	err := row.Scan(
		&k.ID, &k.UserID, &k.PlanID, &k.Name, &k.KeyHash, &k.LookupHash, &k.Display, &k.Scopes, &k.Disabled,
		&k.LastUsedAt, &k.Secret.WrappedDEK, &k.Secret.Ciphertext, &k.CreatedAt, &k.UpdatedAt,
	)
	return k, translateNotFound(err)
}

func (r *APIKeyRepository) FindByLookup(ctx context.Context, lookup string) (models.APIKey, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, user_id, plan_id, name, key_hash, lookup_hash, display, scopes, disabled, last_used_at,
		       secret_wrapped_dek, secret_ciphertext, created_at, updated_at
		FROM api_keys WHERE lookup_hash = $1`, lookup)

	var k models.APIKey
	err := row.Scan(
		&k.ID, &k.UserID, &k.PlanID, &k.Name, &k.KeyHash, &k.LookupHash, &k.Display, &k.Scopes, &k.Disabled,
		&k.LastUsedAt, &k.Secret.WrappedDEK, &k.Secret.Ciphertext, &k.CreatedAt, &k.UpdatedAt,
	)
	return k, translateNotFound(err)
}

func (r *APIKeyRepository) Update(ctx context.Context, k models.APIKey) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE api_keys
		SET name = $2, plan_id = $3, scopes = $4, disabled = $5, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		k.ID, k.Name, k.PlanID, k.Scopes, k.Disabled,
	)
	return err
}

func (r *APIKeyRepository) TouchLastUsed(ctx context.Context, id string, at time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE api_keys SET last_used_at = $2 WHERE id = $1`, id, at)
	return err
}

func (r *APIKeyRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM api_keys WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "api key")
}

// CountByPlan returns how many keys are bound to each plan id.
func (r *APIKeyRepository) CountByPlan(ctx context.Context) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT plan_id, count(*) FROM api_keys WHERE plan_id IS NOT NULL GROUP BY plan_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var id string
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			return nil, err
		}
		counts[id] = n
	}
	return counts, rows.Err()
}
