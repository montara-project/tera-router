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

const skillColumns = `id, name, description, prompt, created_at, updated_at`

func scanSkill(row rowScanner) (models.Skill, error) {
	var s models.Skill
	err := row.Scan(&s.ID, &s.Name, &s.Description, &s.Prompt, &s.CreatedAt, &s.UpdatedAt)
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
	return r.listExec(ctx)
}

func (r *SkillRepository) listExec(ctx context.Context) ([]models.Skill, error) {
	rows, err := r.queryContext(ctx, r.DB, `SELECT `+skillColumns+` FROM skills ORDER BY created_at DESC`)
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

// Delete removes one skill.
func (r *SkillRepository) Delete(ctx context.Context, id string) error {
	return r.deleteExec(ctx, id)
}

func (r *SkillRepository) deleteExec(ctx context.Context, id string) error {
	res, err := r.execContext(ctx, r.DB, `DELETE FROM skills WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "skill")
}
