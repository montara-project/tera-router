package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"strconv"
	"sync/atomic"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/consolelog"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/google/uuid"
)

// auditPendingKey holds the entries a request recorded until AuditTrail
// writes them with the response status.
const auditPendingKey = "audit_pending"

// Counters since this process started, shown on the audit page.
var (
	auditWritten atomic.Int64
	auditLost    atomic.Int64
)

// actorFrom returns the user id for audit entries derived from the JWT
// locals; falls back to "system".
func actorFrom(c fiber.Ctx) string {
	if uid, err := lib.ContextGetUID(c); err == nil {
		return uid.String()
	}
	return "system"
}

// auditRecord queues one audit entry for the current request. AuditTrail
// writes it once the handler returns, so the entry carries the response
// status and its outcome. Audit failures never block the operation that
// triggered them.
func auditRecord(c fiber.Ctx, actor, action, target string, detail any) {

	route := ""
	if r := c.Route(); r != nil {
		route = r.Path
	}
	entry := models.AuditEntry{
		ID:           uuid.NewString(),
		Actor:        actor,
		Action:       action,
		Target:       target,
		Detail:       auditDetail(detail),
		CreatedAt:    time.Now(),
		SessionID:    lib.ContextSID(c),
		Method:       c.Method(),
		Route:        route,
		ClientIP:     clientOf(c).ip,
		ForwardedFor: c.Get(fiber.HeaderXForwardedFor),
		UserAgent:    c.Get(fiber.HeaderUserAgent),
		RequestID:    requestid.FromContext(c),
	}
	pending := fiber.Locals[[]models.AuditEntry](c, auditPendingKey)
	fiber.Locals(c, auditPendingKey, append(pending, entry))
}

// AuditTrail writes the entries a request queued with auditRecord after the
// handler has run. An error is rendered here first, so the entry stores the
// status the client actually received.
func AuditTrail(a *app.Application) fiber.Handler {
	return func(c fiber.Ctx) error {
		err := c.Next()
		pending := fiber.Locals[[]models.AuditEntry](c, auditPendingKey)
		if len(pending) == 0 {
			return err
		}
		if err != nil {
			if herr := middlewares.ErrorHandler(c, err); herr != nil {
				return herr
			}
			err = nil
		}

		status := c.Response().StatusCode()
		for _, e := range pending {
			e.Status = status
			e.Outcome = models.AuditOutcomeSuccess
			if status >= fiber.StatusBadRequest {
				e.Outcome = models.AuditOutcomeFailed
			}
			writeAudit(c.Context(), a, e)
		}
		return err
	}
}

// auditRecordNow writes an entry at once, for work that runs outside a
// dashboard request (an OAuth poll, a background seed). It has no request
// context to record.
func auditRecordNow(ctx context.Context, a *app.Application, actor, action, target string, detail any) {
	writeAudit(ctx, a, models.AuditEntry{ID: uuid.NewString(), Actor: actor, Action: action, Target: target, Detail: auditDetail(detail)})
}

// RecordSystemEvent writes an entry that no request caused, such as the
// server starting or stopping.
func RecordSystemEvent(ctx context.Context, a *app.Application, action string) {
	auditRecordNow(ctx, a, "system", action, "system", nil)
}

// auditDetail encodes the free-form detail as JSON, "{}" when absent.
func auditDetail(detail any) string {
	if detail != nil {
		if b, err := json.Marshal(detail); err == nil {
			return string(b)
		}
	}
	return "{}"
}

func writeAudit(ctx context.Context, a *app.Application, e models.AuditEntry) {
	if err := a.Repos.Audit.Insert(ctx, e); err != nil {
		auditLost.Add(1)
		consolelog.Push(dtos.LogLevelWarn, "audit write failed for "+e.Action+": "+err.Error(), "")
		return
	}
	auditWritten.Add(1)
	consolelog.Push(dtos.LogLevelInfo, e.Action+" · "+e.Target, e.Detail)
}

type auditHandler struct {
	app *app.Application
}

// Index lists audit entries, newest first (GET /v1/audit). Query: search,
// outcome (success|failed), category (action prefix), offset, limit.
func (h *auditHandler) Index(c fiber.Ctx) error {
	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	f := repositories.AuditFilter{
		Search:   c.Query("search"),
		Outcome:  c.Query("outcome"),
		Category: c.Query("category"),
		Offset:   max(offset, 0),
		Limit:    limit,
	}
	rows, total, err := h.app.Repos.Audit.List(c.Context(), f)
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.ListMeta(total, f.Offset, f.Limit))
}

// Stats returns the totals and process counters for the page header
// (GET /v1/audit/stats).
func (h *auditHandler) Stats(c fiber.Ctx) error {
	counts, err := h.app.Repos.Audit.Counts(c.Context())
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"recorded":             counts.Recorded,
		"failed":               counts.Failed,
		"legacy":               counts.Legacy,
		"categories":           counts.Categories,
		"recorded_since_start": auditWritten.Load(),
		"lost":                 auditLost.Load(),
	})
}

// Verify walks the hash chain (POST /v1/audit/verify).
func (h *auditHandler) Verify(c fiber.Ctx) error {
	v, err := h.app.Repos.Audit.Verify(c.Context())
	if err != nil {
		return err
	}
	return dtos.OK(c, v)
}

// Export downloads the whole trail as JSON Lines, oldest first
// (GET /v1/audit/export).
func (h *auditHandler) Export(c fiber.Ctx) error {
	rows, err := h.app.Repos.Audit.All(c.Context())
	if err != nil {
		return err
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	for _, e := range rows {
		if err := enc.Encode(e); err != nil {
			return err
		}
	}
	auditRecord(c, actorFrom(c), "audit.export", "audit", map[string]int{"rows": len(rows)})

	name := "audit-" + time.Now().UTC().Format("20060102-150405") + ".jsonl"
	c.Set(fiber.HeaderContentType, "application/x-ndjson")
	c.Set(fiber.HeaderContentDisposition, `attachment; filename="`+name+`"`)
	return c.Send(buf.Bytes())
}
