package services

import (
	"context"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

type ChainService struct {
	repos *repositories.Repositories
	audit *AuditService
}

func (s *ChainService) Create(ctx context.Context, actor string, c models.Chain) (models.Chain, error) {
	c.ID = uuid.NewString()
	for i := range c.Steps {
		c.Steps[i].ID = uuid.NewString()
		c.Steps[i].ChainID = c.ID
		c.Steps[i].Position = i + 1
	}
	if err := s.repos.Chains.Create(ctx, c); err != nil {
		return models.Chain{}, err
	}
	s.audit.Record(ctx, actor, "chain.create", c.ID, map[string]string{"name": c.Name})
	return s.repos.Chains.FindByID(ctx, c.ID)
}

func (s *ChainService) List(ctx context.Context) ([]models.Chain, error) {
	return s.repos.Chains.List(ctx)
}

func (s *ChainService) Get(ctx context.Context, id string) (models.Chain, error) {
	return s.repos.Chains.FindByID(ctx, id)
}

func (s *ChainService) Update(ctx context.Context, actor string, c models.Chain) (models.Chain, error) {
	for i := range c.Steps {
		c.Steps[i].ID = uuid.NewString()
		c.Steps[i].ChainID = c.ID
		c.Steps[i].Position = i + 1
	}
	if err := s.repos.Chains.Update(ctx, c); err != nil {
		return models.Chain{}, err
	}
	s.audit.Record(ctx, actor, "chain.update", c.ID, nil)
	return s.repos.Chains.FindByID(ctx, c.ID)
}

func (s *ChainService) Delete(ctx context.Context, actor, id string) error {
	if err := s.repos.Chains.Delete(ctx, id); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "chain.delete", id, nil)
	return nil
}

// Usage aggregates usage across the models targeted by a chain's steps.
// The gateway phase populates usage_records; until then this is empty.
func (s *ChainService) Usage(ctx context.Context, id string) ([]repositories.UsageByModel, error) {
	chain, err := s.repos.Chains.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	all, err := s.repos.Usage.ByModel(ctx, timeZero)
	if err != nil {
		return nil, err
	}

	targets := map[string]bool{}
	for _, step := range chain.Steps {
		targets[step.Provider+"\x00"+step.Model] = true
	}
	out := []repositories.UsageByModel{}
	for _, row := range all {
		if targets[row.Provider+"\x00"+row.Model] {
			out = append(out, row)
		}
	}
	return out, nil
}

// AliasList returns every model alias pool.
func (s *ChainService) AliasList(ctx context.Context) ([]models.ModelAlias, error) {
	return s.repos.Aliases.List(ctx)
}

// AliasPut upserts one alias pool by name (PUT semantics from IDRouter).
func (s *ChainService) AliasPut(ctx context.Context, actor string, a models.ModelAlias) (models.ModelAlias, error) {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	for i := range a.Targets {
		a.Targets[i].ID = uuid.NewString()
		a.Targets[i].AliasID = a.ID
		a.Targets[i].Position = i + 1
	}
	if err := s.repos.Aliases.Upsert(ctx, a); err != nil {
		return models.ModelAlias{}, err
	}
	s.audit.Record(ctx, actor, "alias.put", a.Name, map[string]int{"targets": len(a.Targets)})

	all, err := s.repos.Aliases.List(ctx)
	if err != nil {
		return models.ModelAlias{}, err
	}
	for _, existing := range all {
		if existing.Name == a.Name {
			return existing, nil
		}
	}
	return a, nil
}

// AliasDelete removes an alias pool by name.
func (s *ChainService) AliasDelete(ctx context.Context, actor, name string) error {
	if err := s.repos.Aliases.Delete(ctx, name); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "alias.delete", name, nil)
	return nil
}
