package services

import (
	"context"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

type PlanService struct {
	repos *repositories.Repositories
	audit *AuditService
}

func (s *PlanService) Create(ctx context.Context, actor string, p models.Plan) (models.Plan, error) {
	p.ID = uuid.NewString()
	if err := s.repos.Plans.Create(ctx, p); err != nil {
		return models.Plan{}, err
	}
	s.audit.Record(ctx, actor, "plan.create", p.ID, map[string]string{"name": p.Name})
	return p, nil
}

// List returns all plans together with the number of keys bound to each.
func (s *PlanService) List(ctx context.Context) ([]PlanWithKeys, error) {
	plans, err := s.repos.Plans.List(ctx)
	if err != nil {
		return nil, err
	}
	counts, err := s.repos.APIKeys.CountByPlan(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]PlanWithKeys, 0, len(plans))
	for _, p := range plans {
		assigned := counts[p.ID]
		out = append(out, PlanWithKeys{Plan: p, KeysAssigned: assigned})
	}
	return out, nil
}

// PlanWithKeys is a plan plus its assigned-key count for the dashboard list.
type PlanWithKeys struct {
	models.Plan
	KeysAssigned int `json:"keys_assigned"`
}

func (s *PlanService) Get(ctx context.Context, id string) (models.Plan, error) {
	return s.repos.Plans.FindByID(ctx, id)
}

func (s *PlanService) Update(ctx context.Context, actor string, p models.Plan) (models.Plan, error) {
	if err := s.repos.Plans.Update(ctx, p); err != nil {
		return models.Plan{}, err
	}
	s.audit.Record(ctx, actor, "plan.update", p.ID, nil)
	return s.repos.Plans.FindByID(ctx, p.ID)
}

func (s *PlanService) Delete(ctx context.Context, actor, id string) error {
	if err := s.repos.Plans.Delete(ctx, id); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "plan.delete", id, nil)
	return nil
}

// Keys lists the keys bound to one plan.
func (s *PlanService) Keys(ctx context.Context, planID string) ([]repositories.APIKeyWithPlan, int, error) {
	if _, err := s.repos.Plans.FindByID(ctx, planID); err != nil {
		return nil, 0, err
	}

	keys, _, err := s.repos.APIKeys.List(ctx, 0, 100)
	if err != nil {
		return nil, 0, err
	}

	out := []repositories.APIKeyWithPlan{}
	for _, k := range keys {
		if k.PlanID != nil && *k.PlanID == planID {
			out = append(out, k)
		}
	}
	return out, len(out), nil
}
