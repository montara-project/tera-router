package repositories

import (
	"context"
	"database/sql"

	"tera-router/server/internal/models"
)

type ChainRepository struct {
	db *sql.DB
}

const chainColumns = `
	id, name, strategy, fallback_provider, fallback_model, context_window, enabled, created_at, updated_at`

func (r *ChainRepository) Create(ctx context.Context, c models.Chain) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO chains (id, name, strategy, fallback_provider, fallback_model, context_window, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		c.ID, c.Name, c.Strategy, c.FallbackProvider, c.FallbackModel, c.ContextWindow, c.Enabled,
	); err != nil {
		return err
	}
	if err := insertChainSteps(ctx, tx, c.ID, c.Steps); err != nil {
		return err
	}
	return tx.Commit()
}

func insertChainSteps(ctx context.Context, tx *sql.Tx, chainID string, steps []models.ChainStep) error {
	for _, s := range steps {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO chain_steps (id, chain_id, position, provider, model)
			VALUES ($1, $2, $3, $4, $5)`,
			s.ID, chainID, s.Position, s.Provider, s.Model,
		); err != nil {
			return err
		}
	}
	return nil
}

func (r *ChainRepository) List(ctx context.Context) ([]models.Chain, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT`+chainColumns+` FROM chains ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	chains := []models.Chain{}
	for rows.Next() {
		var c models.Chain
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Strategy, &c.FallbackProvider, &c.FallbackModel, &c.ContextWindow,
			&c.Enabled, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		chains = append(chains, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return r.attachSteps(ctx, chains)
}

func (r *ChainRepository) attachSteps(ctx context.Context, chains []models.Chain) ([]models.Chain, error) {
	rows, err := r.db.QueryContext(ctx, `
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
			return nil, err
		}
		stepsByChain[s.ChainID] = append(stepsByChain[s.ChainID], s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range chains {
		chains[i].Steps = stepsByChain[chains[i].ID]
		if chains[i].Steps == nil {
			chains[i].Steps = []models.ChainStep{}
		}
	}
	return chains, nil
}

func (r *ChainRepository) FindByID(ctx context.Context, id string) (models.Chain, error) {
	row := r.db.QueryRowContext(ctx, `SELECT`+chainColumns+` FROM chains WHERE id = $1`, id)
	var c models.Chain
	err := row.Scan(
		&c.ID, &c.Name, &c.Strategy, &c.FallbackProvider, &c.FallbackModel, &c.ContextWindow,
		&c.Enabled, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return models.Chain{}, translateNotFound(err)
	}

	attached, err := r.attachSteps(ctx, []models.Chain{c})
	if err != nil {
		return models.Chain{}, err
	}
	return attached[0], nil
}

func (r *ChainRepository) Update(ctx context.Context, c models.Chain) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		UPDATE chains
		SET name = $2, strategy = $3, fallback_provider = $4, fallback_model = $5,
		    context_window = $6, enabled = $7, updated_at = now()
		WHERE id = $1`,
		c.ID, c.Name, c.Strategy, c.FallbackProvider, c.FallbackModel, c.ContextWindow, c.Enabled,
	)
	if err != nil {
		return err
	}
	if err := requireAffected(res, "chain"); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM chain_steps WHERE chain_id = $1`, c.ID); err != nil {
		return err
	}
	if err := insertChainSteps(ctx, tx, c.ID, c.Steps); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *ChainRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM chains WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "chain")
}
