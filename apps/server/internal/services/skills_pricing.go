package services

import (
	"context"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

type SkillService struct {
	repos *repositories.Repositories
	audit *AuditService
}

func (s *SkillService) Create(ctx context.Context, actor string, skill models.Skill) (models.Skill, error) {
	skill.ID = uuid.NewString()
	if err := s.repos.Skills.Create(ctx, skill); err != nil {
		return models.Skill{}, err
	}
	s.audit.Record(ctx, actor, "skill.create", skill.ID, map[string]string{"name": skill.Name})
	return skill, nil
}

func (s *SkillService) List(ctx context.Context) ([]models.Skill, error) {
	return s.repos.Skills.List(ctx)
}

func (s *SkillService) Delete(ctx context.Context, actor, id string) error {
	if err := s.repos.Skills.Delete(ctx, id); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "skill.delete", id, nil)
	return nil
}

type PricingService struct {
	repos *repositories.Repositories
	audit *AuditService
}

// UpsertPricing inserts or updates one (provider, model) pricing override.
func (s *PricingService) UpsertPricing(ctx context.Context, actor string, p models.PricingOverride) (models.PricingOverride, error) {
	p.ID = uuid.NewString()
	if err := s.repos.Pricing.Upsert(ctx, p); err != nil {
		return models.PricingOverride{}, err
	}
	s.audit.Record(ctx, actor, "pricing.upsert", p.Provider+"/"+p.Model, nil)
	return p, nil
}

func (s *PricingService) ListPricing(ctx context.Context, provider string) ([]models.PricingOverride, error) {
	return s.repos.Pricing.List(ctx, provider)
}

func (s *PricingService) DeletePricing(ctx context.Context, actor, provider, model string) error {
	if err := s.repos.Pricing.Delete(ctx, provider, model); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "pricing.delete", provider+"/"+model, nil)
	return nil
}

// UpsertCapability sets the capability list for one (provider, model) pair.
func (s *PricingService) UpsertCapability(ctx context.Context, actor string, c models.CapabilityOverride) (models.CapabilityOverride, error) {
	c.ID = uuid.NewString()
	if err := s.repos.Capability.Upsert(ctx, c); err != nil {
		return models.CapabilityOverride{}, err
	}
	s.audit.Record(ctx, actor, "capability.upsert", c.Provider+"/"+c.Model, c.Capabilities)
	return c, nil
}

func (s *PricingService) ListCapabilities(ctx context.Context) ([]models.CapabilityOverride, error) {
	return s.repos.Capability.List(ctx)
}

func (s *PricingService) DeleteCapability(ctx context.Context, actor, provider, model string) error {
	if err := s.repos.Capability.Delete(ctx, provider, model); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "capability.delete", provider+"/"+model, nil)
	return nil
}

func (s *PricingService) ResetCapabilities(ctx context.Context, actor string) error {
	if err := s.repos.Capability.Reset(ctx); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "capability.reset", "*", nil)
	return nil
}
