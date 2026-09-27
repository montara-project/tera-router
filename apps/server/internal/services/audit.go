package services

import (
	"context"
	"encoding/json"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

type AuditService struct {
	repos   *repositories.AuditRepository
	console *ConsoleService
}

func NewAuditService(audit *repositories.AuditRepository, console *ConsoleService) *AuditService {
	return &AuditService{repos: audit, console: console}
}

// Record appends one audit entry and mirrors it into the console feed.
// Audit failures never block the operation that triggered them.
func (s *AuditService) Record(ctx context.Context, actor, action, target string, detail any) {
	raw := "{}"
	if detail != nil {
		if b, err := json.Marshal(detail); err == nil {
			raw = string(b)
		}
	}

	entry := models.AuditEntry{
		ID:     uuid.NewString(),
		Actor:  actor,
		Action: action,
		Target: target,
		Detail: raw,
	}
	if err := s.repos.Insert(ctx, entry); err != nil {
		s.console.Push(LogLevelWarn, "audit write failed for "+action+": "+err.Error(), "")
		return
	}
	s.console.Push(LogLevelInfo, action+" · "+target, raw)
}

// List returns the most recent audit entries.
func (s *AuditService) List(ctx context.Context, limit int) ([]models.AuditEntry, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	return s.repos.List(ctx, limit)
}
