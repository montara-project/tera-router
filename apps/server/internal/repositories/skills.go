package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

type SkillRepository struct {
	db *sql.DB
}

const skillColumns = `id, name, description, prompt, created_at, updated_at`

func scanSkill(row interface{ Scan(...any) error }) (models.Skill, error) {
	var s models.Skill
	err := row.Scan(&s.ID, &s.Name, &s.Description, &s.Prompt, &s.CreatedAt, &s.UpdatedAt)
	return s, translateNotFound(err)
}

func (r *SkillRepository) Create(ctx context.Context, s models.Skill) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO skills (id, name, description, prompt) VALUES ($1, $2, $3, $4)`,
		s.ID, s.Name, s.Description, s.Prompt,
	)
	return err
}

func (r *SkillRepository) List(ctx context.Context) ([]models.Skill, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+skillColumns+` FROM skills ORDER BY created_at DESC`)
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
	return skills, rows.Err()
}

func (r *SkillRepository) Update(ctx context.Context, s models.Skill) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE skills SET name = $2, description = $3, prompt = $4, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`,
		s.ID, s.Name, s.Description, s.Prompt,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "skill")
}

func (r *SkillRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM skills WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "skill")
}
