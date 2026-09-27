package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

// AliasRepository manages model alias pools. Writes replace the whole pool
// (PUT semantics from IDRouter): name, targets, and active flag together.
type AliasRepository struct {
	db *sql.DB
}

func (r *AliasRepository) Upsert(ctx context.Context, a models.ModelAlias) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO model_aliases (id, name, context_window, active)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (name) DO UPDATE
		SET context_window = EXCLUDED.context_window, active = EXCLUDED.active, updated_at = now()`,
		a.ID, a.Name, a.ContextWindow, a.Active,
	); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM alias_targets
		WHERE alias_id = (SELECT id FROM model_aliases WHERE name = $1)`, a.Name); err != nil {
		return err
	}

	for _, t := range a.Targets {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO alias_targets (id, alias_id, position, provider, model, active)
			VALUES ($1, (SELECT id FROM model_aliases WHERE name = $2), $3, $4, $5, $6)`,
			t.ID, a.Name, t.Position, t.Provider, t.Model, t.Active,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *AliasRepository) List(ctx context.Context) ([]models.ModelAlias, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, context_window, active, created_at, updated_at
		FROM model_aliases ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	aliases := []models.ModelAlias{}
	for rows.Next() {
		var a models.ModelAlias
		if err := rows.Scan(&a.ID, &a.Name, &a.ContextWindow, &a.Active, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		aliases = append(aliases, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return r.attachTargets(ctx, aliases)
}

func (r *AliasRepository) attachTargets(ctx context.Context, aliases []models.ModelAlias) ([]models.ModelAlias, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, alias_id, position, provider, model, active
		FROM alias_targets ORDER BY alias_id, position`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byAlias := map[string][]models.AliasTarget{}
	for rows.Next() {
		var t models.AliasTarget
		if err := rows.Scan(&t.ID, &t.AliasID, &t.Position, &t.Provider, &t.Model, &t.Active); err != nil {
			return nil, err
		}
		byAlias[t.AliasID] = append(byAlias[t.AliasID], t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range aliases {
		aliases[i].Targets = byAlias[aliases[i].ID]
		if aliases[i].Targets == nil {
			aliases[i].Targets = []models.AliasTarget{}
		}
	}
	return aliases, nil
}

func (r *AliasRepository) Delete(ctx context.Context, name string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM model_aliases WHERE name = $1`, name)
	if err != nil {
		return err
	}
	return requireAffected(res, "model alias")
}
