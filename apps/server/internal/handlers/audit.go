package handlers

import (
	"context"
	"encoding/json"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// actorFrom returns the user id for audit entries derived from the JWT
// locals; falls back to "system".
func actorFrom(c fiber.Ctx) string {
	if uid, err := lib.ContextGetUID(c); err == nil {
		return uid.String()
	}
	return "system"
}

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
		ConsolePush(dtos.LogLevelWarn, "audit write failed for "+action+": "+err.Error(), "")
		return
	}
	ConsolePush(dtos.LogLevelInfo, action+" · "+target, raw)
}
