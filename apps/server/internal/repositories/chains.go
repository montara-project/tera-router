package repositories

import (
	"context"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// ChainRepository manages routing chains and their ordered steps. Writes
// replace the whole step list, so chain and steps always move atomically.
type ChainRepository struct {
	BaseRepository
}

const chainColumns = `
	id, name, strategy, fallback_provider, fallback_model, context_window, enabled, created_at, updated_at`

func scanChain(row rowScanner) (models.Chain, error) {
	var c models.Chain
	err := row.Scan(
		&c.ID, &c.Name, &c.Strategy, &c.FallbackProvider, &c.FallbackModel, &c.ContextWindow,
		&c.Enabled, &c.CreatedAt, &c.UpdatedAt,
	)
	return c, translateNotFound(err)
}

// Insert persists a chain and its steps in one transaction.
func (r *ChainRepository) Insert(ctx context.Context, c models.Chain) error {
	return withTx(ctx, r.DB, func(tx Executor) error {
		return r.insertExec(ctx, tx, c)
	})
}

func (r *ChainRepository) insertExec(ctx context.Context, ex Executor, c models.Chain) error {
	if _, err := r.execContext(ctx, ex, `
		INSERT INTO chains (id, name, strategy, fallback_provider, fallback_model, context_window, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		c.ID, c.Name, c.Strategy, c.FallbackProvider, c.FallbackModel, c.ContextWindow, c.Enabled,
	); err != nil {
		return err
	}
	return r.insertStepsExec(ctx, ex, c.ID, c.Steps)
}

func (r *ChainRepository) insertStepsExec(ctx context.Context, ex Executor, chainID string, steps []models.ChainStep) error {
	for _, s := range steps {
		if _, err := r.execContext(ctx, ex, `
			INSERT INTO chain_steps (id, chain_id, position, provider, model)
			VALUES ($1, $2, $3, $4, $5)`,
			s.ID, chainID, s.Position, s.Provider, s.Model,
		); err != nil {
			return err
		}
	}
	return nil
}

// List returns every chain with its steps attached, newest first.
func (r *ChainRepository) List(ctx context.Context) ([]models.Chain, error) {
	return r.listExec(ctx, r.DB)
}

func (r *ChainRepository) listExec(ctx context.Context, ex Executor) ([]models.Chain, error) {
	rows, err := r.queryContext(ctx, ex, `SELECT`+chainColumns+` FROM chains ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	chains := []models.Chain{}
	for rows.Next() {
		c, err := scanChain(rows)
		if err != nil {
			return nil, err
		}
		chains = append(chains, c)
	}
	if err := rows.Err(); err != nil {
		return nil, errtrace.Wrap(err)
	}
	return r.attachStepsExec(ctx, ex, chains)
}

func (r *ChainRepository) attachStepsExec(ctx context.Context, ex Executor, chains []models.Chain) ([]models.Chain, error) {
	rows, err := r.queryContext(ctx, ex, `
		SELECT id, chain_id, position, provider, model, created_at
		FROM chain_steps ORDER BY chain_id, position`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stepsByChain := map[string][]models.ChainStep{}
	for rows.Next() {
		var s models.ChainStep
		if err := rows.Scan(&s.ID, &s.ChainID, &s.Position, &s.Provider, &s.Model, &s.CreatedAt); err != nil {
			return nil, errtrace.Wrap(err)
		}
		stepsByChain[s.ChainID] = append(stepsByChain[s.ChainID], s)
	}
	if err := rows.Err(); err != nil {
		return nil, errtrace.Wrap(err)
	}

	for i := range chains {
		chains[i].Steps = stepsByChain[chains[i].ID]
		if chains[i].Steps == nil {
			chains[i].Steps = []models.ChainStep{}
		}
	}
	return chains, nil
}

// Get returns one chain by id with its steps attached.
func (r *ChainRepository) Get(ctx context.Context, id string) (models.Chain, error) {
	return r.getExec(ctx, r.DB, id)
}

func (r *ChainRepository) getExec(ctx context.Context, ex Executor, id string) (models.Chain, error) {
	row := r.queryRowContext(ctx, ex, `SELECT`+chainColumns+` FROM chains WHERE id = $1`, id)
	c, err := scanChain(row)
	if err != nil {
		return models.Chain{}, err
	}

	attached, err := r.attachStepsExec(ctx, ex, []models.Chain{c})
	if err != nil {
		return models.Chain{}, err
	}
	return attached[0], nil
}

// Update rewrites a chain and replaces its steps in one transaction.
func (r *ChainRepository) Update(ctx context.Context, c models.Chain) error {
	return withTx(ctx, r.DB, func(tx Executor) error {
		return r.updateExec(ctx, tx, c)
	})
}

func (r *ChainRepository) updateExec(ctx context.Context, ex Executor, c models.Chain) error {
	res, err := r.execContext(ctx, ex, `
		UPDATE chains
		SET name = $2, strategy = $3, fallback_provider = $4, fallback_model = $5,
		    context_window = $6, enabled = $7, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')
		WHERE id = $1`,
		c.ID, c.Name, c.Strategy, c.FallbackProvider, c.FallbackModel, c.ContextWindow, c.Enabled,
	)
	if err != nil {
		return err
	}
	if err := requireAffected(res, "chain"); err != nil {
		return err
	}

	if _, err := r.execContext(ctx, ex, `DELETE FROM chain_steps WHERE chain_id = $1`, c.ID); err != nil {
		return err
	}
	return r.insertStepsExec(ctx, ex, c.ID, c.Steps)
}

// Delete removes one chain; its steps go with it via ON DELETE CASCADE.
func (r *ChainRepository) Delete(ctx context.Context, id string) error {
	return r.deleteExec(ctx, r.DB, id)
}

func (r *ChainRepository) deleteExec(ctx context.Context, ex Executor, id string) error {
	res, err := r.execContext(ctx, ex, `DELETE FROM chains WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "chain")
}
