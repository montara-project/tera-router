package repositories

import (
	"context"
	"time"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// APIKeyRepository manages inbound API keys. Only hashes and the
// envelope-encrypted copy are stored; the plaintext is never persisted.
type APIKeyRepository struct {
	BaseRepository
}

// APIKeyWithPlan is a key joined with its bound plan for listing.
type APIKeyWithPlan struct {
	models.APIKey
	PlanName *string
	PlanNote *string
}

const apiKeyColumns = `
	id, user_id, plan_id, name, key_hash, lookup_hash, display, scopes, disabled, last_used_at,
	allowed_models, skill_ids, secret_wrapped_dek, secret_ciphertext, created_at, updated_at`

func scanAPIKey(row rowScanner) (models.APIKey, error) {
	var k models.APIKey
	err := row.Scan(
		&k.ID, &k.UserID, &k.PlanID, &k.Name, &k.KeyHash, &k.LookupHash, &k.Display, &k.Scopes, &k.Disabled,
		&k.LastUsedAt, (*jsonStrings)(&k.AllowedModels), (*jsonStrings)(&k.SkillIDs), &k.Secret.WrappedDEK, &k.Secret.Ciphertext,
		&k.CreatedAt, &k.UpdatedAt,
	)
	return k, translateNotFound(err)
}

// Insert persists a new API key.
func (r *APIKeyRepository) Insert(ctx context.Context, k models.APIKey) error {
	return r.insertExec(ctx, k)
}

func (r *APIKeyRepository) insertExec(ctx context.Context, k models.APIKey) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO api_keys (id, user_id, plan_id, name, key_hash, lookup_hash, display, scopes, disabled, allowed_models, skill_ids, secret_wrapped_dek, secret_ciphertext)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		k.ID, k.UserID, k.PlanID, k.Name, k.KeyHash, k.LookupHash, k.Display, k.Scopes, k.Disabled,
		jsonStrings(k.AllowedModels), jsonStrings(k.SkillIDs), k.Secret.WrappedDEK, k.Secret.Ciphertext,
	)
	return err
}

// List returns a page of keys joined with their plan, newest-first, plus the
// unpaged total.
func (r *APIKeyRepository) List(ctx context.Context, offset, limit int) ([]APIKeyWithPlan, int, error) {
	return r.listExec(ctx, offset, limit)
}

func (r *APIKeyRepository) listExec(ctx context.Context, offset, limit int) ([]APIKeyWithPlan, int, error) {
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT k.id, k.user_id, k.plan_id, k.name, k.display, k.scopes, k.disabled, k.last_used_at,
		       k.allowed_models, k.skill_ids, k.secret_wrapped_dek, k.secret_ciphertext, k.created_at, k.updated_at,
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
			(*jsonStrings)(&k.AllowedModels), (*jsonStrings)(&k.SkillIDs), &k.Secret.WrappedDEK, &k.Secret.Ciphertext,
			&k.CreatedAt, &k.UpdatedAt,
			&k.PlanName, &k.PlanNote, &totalRows,
		); err != nil {
			return nil, 0, errtrace.Wrap(err)
		}
		total = totalRows
		keys = append(keys, k)
	}
	return keys, total, errtrace.Wrap(rows.Err())
}

// Get returns one key by id.
func (r *APIKeyRepository) Get(ctx context.Context, id string) (models.APIKey, error) {
	return r.getExec(ctx, id)
}

func (r *APIKeyRepository) getExec(ctx context.Context, id string) (models.APIKey, error) {
	row := r.queryRowContext(ctx, r.DB,
		`SELECT`+apiKeyColumns+` FROM api_keys WHERE id = $1`, id)
	return scanAPIKey(row)
}

// GetWithPlan returns one key joined with its bound plan, the detail view's
// shape. PlanName/PlanNote are nil when the key has no plan.
func (r *APIKeyRepository) GetWithPlan(ctx context.Context, id string) (APIKeyWithPlan, error) {
	return r.getWithPlanExec(ctx, id)
}

func (r *APIKeyRepository) getWithPlanExec(ctx context.Context, id string) (APIKeyWithPlan, error) {
	var k APIKeyWithPlan
	err := r.queryRowContext(ctx, r.DB, `
		SELECT k.id, k.user_id, k.plan_id, k.name, k.display, k.scopes, k.disabled, k.last_used_at,
		       k.allowed_models, k.skill_ids, k.secret_wrapped_dek, k.secret_ciphertext, k.created_at, k.updated_at,
		       p.name, p.description
		FROM api_keys k
		LEFT JOIN plans p ON p.id = k.plan_id
		WHERE k.id = $1`, id).Scan(
		&k.ID, &k.UserID, &k.PlanID, &k.Name, &k.Display, &k.Scopes, &k.Disabled, &k.LastUsedAt,
		(*jsonStrings)(&k.AllowedModels), (*jsonStrings)(&k.SkillIDs), &k.Secret.WrappedDEK, &k.Secret.Ciphertext,
		&k.CreatedAt, &k.UpdatedAt,
		&k.PlanName, &k.PlanNote,
	)
	return k, translateNotFound(err)
}

// GetByLookup resolves a key by its fast sha-256 lookup index, ahead of the
// expensive argon2 verification.
func (r *APIKeyRepository) GetByLookup(ctx context.Context, lookup string) (models.APIKey, error) {
	return r.getByLookupExec(ctx, lookup)
}

func (r *APIKeyRepository) getByLookupExec(ctx context.Context, lookup string) (models.APIKey, error) {
	row := r.queryRowContext(ctx, r.DB,
		`SELECT`+apiKeyColumns+` FROM api_keys WHERE lookup_hash = $1`, lookup)
	return scanAPIKey(row)
}

// Update rewrites a key's mutable fields.
func (r *APIKeyRepository) Update(ctx context.Context, k models.APIKey) error {
	return r.updateExec(ctx, k)
}

func (r *APIKeyRepository) updateExec(ctx context.Context, k models.APIKey) error {
	_, err := r.execContext(ctx, r.DB, `
		UPDATE api_keys
		SET name = $2, plan_id = $3, scopes = $4, disabled = $5, allowed_models = $6, skill_ids = $7, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		k.ID, k.Name, k.PlanID, k.Scopes, k.Disabled, jsonStrings(k.AllowedModels), jsonStrings(k.SkillIDs),
	)
	return err
}

// TouchLastUsed stamps the last-used timestamp of a key.
func (r *APIKeyRepository) TouchLastUsed(ctx context.Context, id string, at time.Time) error {
	return r.touchLastUsedExec(ctx, id, at)
}

func (r *APIKeyRepository) touchLastUsedExec(ctx context.Context, id string, at time.Time) error {
	_, err := r.execContext(ctx, r.DB,
		`UPDATE api_keys SET last_used_at = $2 WHERE id = $1`, id, at)
	return err
}

// Delete removes one key.
func (r *APIKeyRepository) Delete(ctx context.Context, id string) error {
	return r.deleteExec(ctx, id)
}

func (r *APIKeyRepository) deleteExec(ctx context.Context, id string) error {
	res, err := r.execContext(ctx, r.DB, `DELETE FROM api_keys WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "api key")
}

// CountByPlan returns how many keys are bound to each plan id.
func (r *APIKeyRepository) CountByPlan(ctx context.Context) (map[string]int, error) {
	return r.countByPlanExec(ctx)
}

func (r *APIKeyRepository) countByPlanExec(ctx context.Context) (map[string]int, error) {
	rows, err := r.queryContext(ctx, r.DB,
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
			return nil, errtrace.Wrap(err)
		}
		counts[id] = n
	}
	return counts, errtrace.Wrap(rows.Err())
}
