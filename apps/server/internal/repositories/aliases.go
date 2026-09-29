package repositories

import (
	"context"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// AliasRepository manages model alias pools. Writes replace the whole pool
// (PUT semantics from IDRouter): name, targets, and active flag together.
type AliasRepository struct {
	BaseRepository
}

const aliasColumns = `id, name, context_window, active, created_at, updated_at`

// Upsert writes an alias and replaces its target list in one transaction.
func (r *AliasRepository) Upsert(ctx context.Context, a models.ModelAlias) error {
	return withTx(ctx, r.DB, func(tx Executor) error {
		return r.upsertExec(ctx, tx, a)
	})
}

func (r *AliasRepository) upsertExec(ctx context.Context, ex Executor, a models.ModelAlias) error {
	if _, err := r.execContext(ctx, ex, `
		INSERT INTO model_aliases (id, name, context_window, active)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (name) DO UPDATE
		SET context_window = EXCLUDED.context_window, active = EXCLUDED.active, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')`,
		a.ID, a.Name, a.ContextWindow, a.Active,
	); err != nil {
		return err
	}

	if _, err := r.execContext(ctx, ex, `
		DELETE FROM alias_targets
		WHERE alias_id = (SELECT id FROM model_aliases WHERE name = $1)`, a.Name); err != nil {
		return err
	}

	for _, t := range a.Targets {
		if _, err := r.execContext(ctx, ex, `
			INSERT INTO alias_targets (id, alias_id, position, provider, model, active)
			VALUES ($1, (SELECT id FROM model_aliases WHERE name = $2), $3, $4, $5, $6)`,
			t.ID, a.Name, t.Position, t.Provider, t.Model, t.Active,
		); err != nil {
			return err
		}
	}
	return nil
}

// List returns every alias with its targets attached, newest first.
func (r *AliasRepository) List(ctx context.Context) ([]models.ModelAlias, error) {
	return r.listExec(ctx, r.DB)
}

func (r *AliasRepository) listExec(ctx context.Context, ex Executor) ([]models.ModelAlias, error) {
	rows, err := r.queryContext(ctx, ex, `
		SELECT `+aliasColumns+`
		FROM model_aliases ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	aliases := []models.ModelAlias{}
	for rows.Next() {
		var a models.ModelAlias
		if err := rows.Scan(&a.ID, &a.Name, &a.ContextWindow, &a.Active, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, errtrace.Wrap(err)
		}
		aliases = append(aliases, a)
	}
	if err := rows.Err(); err != nil {
		return nil, errtrace.Wrap(err)
	}
	return r.attachTargetsExec(ctx, ex, aliases)
}

func (r *AliasRepository) attachTargetsExec(ctx context.Context, ex Executor, aliases []models.ModelAlias) ([]models.ModelAlias, error) {
	rows, err := r.queryContext(ctx, ex, `
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
			return nil, errtrace.Wrap(err)
		}
		byAlias[t.AliasID] = append(byAlias[t.AliasID], t)
	}
	if err := rows.Err(); err != nil {
		return nil, errtrace.Wrap(err)
	}

	for i := range aliases {
		aliases[i].Targets = byAlias[aliases[i].ID]
		if aliases[i].Targets == nil {
			aliases[i].Targets = []models.AliasTarget{}
		}
	}
	return aliases, nil
}

// Delete removes one alias pool by name; targets cascade.
func (r *AliasRepository) Delete(ctx context.Context, name string) error {
	return r.deleteExec(ctx, r.DB, name)
}

func (r *AliasRepository) deleteExec(ctx context.Context, ex Executor, name string) error {
	res, err := r.execContext(ctx, ex, `DELETE FROM model_aliases WHERE name = $1`, name)
	if err != nil {
		return err
	}
	return requireAffected(res, "model alias")
}
