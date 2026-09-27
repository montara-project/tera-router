package handlers

import (
	"context"
	"encoding/json"

	"tera-router/server/internal/app"
	"tera-router/server/internal/models"

	"github.com/google/uuid"
)

// auditRecord appends one audit entry and mirrors it into the console feed.
// Audit failures never block the operation that triggered them.
func auditRecord(ctx context.Context, a *app.Application, actor, action, target string, detail any) {
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
	if err := a.Repos.Audit.Insert(ctx, entry); err != nil {
		ConsolePush(LogLevelWarn, "audit write failed for "+action+": "+err.Error(), "")
		return
	}
	ConsolePush(LogLevelInfo, action+" · "+target, raw)
}
