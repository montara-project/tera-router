package repositories

import (
	"context"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// SkillRepository manages reusable prompt skills.
type SkillRepository struct {
	BaseRepository
}

const skillColumns = `id, name, description, prompt, enabled, created_at, updated_at`

func scanSkill(row rowScanner) (models.Skill, error) {
	var s models.Skill
	err := row.Scan(&s.ID, &s.Name, &s.Description, &s.Prompt, &s.Enabled, &s.CreatedAt, &s.UpdatedAt)
	return s, translateNotFound(err)
}

// Insert persists a new skill.
func (r *SkillRepository) Insert(ctx context.Context, s models.Skill) error {
	return r.insertExec(ctx, s)
}

func (r *SkillRepository) insertExec(ctx context.Context, s models.Skill) error {
	_, err := r.execContext(ctx, r.DB, `
		INSERT INTO skills (id, name, description, prompt) VALUES ($1, $2, $3, $4)`,
		s.ID, s.Name, s.Description, s.Prompt,
	)
	return err
}

// List returns every skill, newest first.
func (r *SkillRepository) List(ctx context.Context) ([]models.Skill, error) {
	return r.listExec(ctx, `SELECT `+skillColumns+` FROM skills ORDER BY created_at DESC`)
}

// ListForKey returns the skills the gateway injects into a request made with
// the given API key: every globally enabled skill plus the ones that key
// selected, oldest first. The order is stable so the injected text — and with
// it any upstream prompt cache — does not change between requests. The key's
// selection is read here rather than from the gateway's cached key record, so
// a change takes effect on the next request.
func (r *SkillRepository) ListForKey(ctx context.Context, keyID string) ([]models.Skill, error) {
	return r.listExec(ctx, `
		SELECT `+skillColumns+` FROM skills
		WHERE enabled = 1 OR id IN (
			SELECT j.value FROM api_keys k, json_each(k.skill_ids) j WHERE k.id = $1
		)
		ORDER BY created_at ASC, id ASC`, keyID)
}

func (r *SkillRepository) listExec(ctx context.Context, query string, args ...any) ([]models.Skill, error) {
	rows, err := r.queryContext(ctx, r.DB, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	skills := []models.Skill{}
	for rows.Next() {
		s, err := scanSkill(rows)
		if err != nil {
			return nil, err
		}
		skills = append(skills, s)
	}
	return skills, errtrace.Wrap(rows.Err())
}

// Get returns one skill by id.
func (r *SkillRepository) Get(ctx context.Context, id string) (models.Skill, error) {
	return r.getExec(ctx, id)
}

func (r *SkillRepository) getExec(ctx context.Context, id string) (models.Skill, error) {
	row := r.queryRowContext(ctx, r.DB, `SELECT `+skillColumns+` FROM skills WHERE id = $1`, id)
	return scanSkill(row)
}

// Update rewrites a skill.
func (r *SkillRepository) Update(ctx context.Context, s models.Skill) error {
	return r.updateExec(ctx, s)
}

func (r *SkillRepository) updateExec(ctx context.Context, s models.Skill) error {
	res, err := r.execContext(ctx, r.DB, `
		UPDATE skills SET name = $2, description = $3, prompt = $4, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`,
		s.ID, s.Name, s.Description, s.Prompt,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "skill")
}

// SetEnabled switches gateway injection for one skill on or off.
func (r *SkillRepository) SetEnabled(ctx context.Context, id string, enabled bool) error {
	return r.setEnabledExec(ctx, id, enabled)
}

func (r *SkillRepository) setEnabledExec(ctx context.Context, id string, enabled bool) error {
	res, err := r.execContext(ctx, r.DB, `
		UPDATE skills SET enabled = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`,
		id, enabled,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "skill")
}

// Delete removes one skill and, in the same transaction, every reference to
// it: the id is stripped from the skill selection of each API key that picked
// it, so no key is left pointing at a skill that no longer exists.
func (r *SkillRepository) Delete(ctx context.Context, id string) error {
	return r.withTx(ctx, func(tx Executor) error {
		if err := r.deleteExec(ctx, tx, id); err != nil {
			return err
		}
		// skill_ids is a JSON array, not a join table, so there is no foreign
		// key to cascade; the array is rebuilt without the deleted id.
		_, err := r.execContext(ctx, tx, `
			UPDATE api_keys
			SET skill_ids = (SELECT json_group_array(j.value) FROM json_each(api_keys.skill_ids) j WHERE j.value != $1)
			WHERE EXISTS (SELECT 1 FROM json_each(api_keys.skill_ids) j WHERE j.value = $1)`, id)
		return err
	})
}

func (r *SkillRepository) deleteExec(ctx context.Context, ex Executor, id string) error {
	res, err := r.execContext(ctx, ex, `DELETE FROM skills WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "skill")
}
