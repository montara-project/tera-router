package gateway

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"tera-router/server/internal/consolelog"
	"tera-router/server/internal/dtos"

	"github.com/gofiber/fiber/v3"
)

// traceLocal is the Fiber locals key holding the request's console trace.
const traceLocal = "gateway.trace"

// requestTrace collects one API request's outcome and timeline for the
// dashboard Console, and writes it as a single feed entry when the request
// ends. Every method is safe on a nil trace (requests that never passed the
// trace middleware, such as the playground).
type requestTrace struct {
	mu       sync.Mutex
	start    time.Time
	req      dtos.ConsoleRequest
	routed   bool
	deferred bool
	done     bool
	// lastTarget is the most recent upstream attempted, for a failed summary.
	lastTarget string
}

// traceMiddleware opens a trace before authentication (so rejected keys are
// logged too) and closes it with the response status once the handler
// returns, unless a stream took ownership of finishing it.
func (s *Server) traceMiddleware(c fiber.Ctx) error {
	t := &requestTrace{
		start: time.Now(),
		req: dtos.ConsoleRequest{
			Endpoint: c.Method() + " " + c.Path(),
			Client:   detectClient(c),
			Events:   []dtos.ConsoleEvent{},
		},
	}
	c.Locals(traceLocal, t)
	err := c.Next()
	if !t.isDeferred() {
		status := c.Response().StatusCode()
		if err != nil {
			status = fiber.StatusInternalServerError
			if fe, ok := err.(*fiber.Error); ok {
				status = fe.Code
			}
			t.reject(err.Error())
		}
		t.finish(status)
	}
	return err
}

func traceFrom(c fiber.Ctx) *requestTrace {
	t, _ := c.Locals(traceLocal).(*requestTrace)
	return t
}

func (t *requestTrace) update(fn func(r *dtos.ConsoleRequest)) {
	if t == nil {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	fn(&t.req)
}

// event appends one timeline step at the current offset.
func (t *requestTrace) event(kind, text string) {
	if t == nil {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	t.req.Events = append(t.req.Events, dtos.ConsoleEvent{
		OffsetMs: time.Since(t.start).Milliseconds(),
		Kind:     kind,
		Text:     text,
	})
}

// setKey records the authenticated API key's name.
func (t *requestTrace) setKey(name string) {
	t.update(func(r *dtos.ConsoleRequest) { r.KeyName = name })
}

// received records the parsed request.
func (t *requestTrace) received(requestID, keyName, model string, messages int, stream bool, bytes int) {
	t.update(func(r *dtos.ConsoleRequest) {
		r.RequestID, r.KeyName, r.Model = requestID, keyName, model
	})
	mode := "standard"
	if stream {
		mode = "stream"
	}
	t.event("received", fmt.Sprintf("Received · %s · %d message%s · %s · %d B", model, messages, plural(messages), mode, bytes))
}

// routedTo records the first upstream target and how many fallbacks follow.
func (t *requestTrace) routedTo(target string, fallbacks int) {
	if t == nil {
		return
	}
	t.mu.Lock()
	t.routed = true
	t.mu.Unlock()
	text := "Routed to " + target
	if fallbacks > 0 {
		text += fmt.Sprintf(" (+%d fallback%s)", fallbacks, plural(fallbacks))
	}
	t.event("routed", text)
}

// attemptFailed records an upstream attempt that failed (the request may
// still succeed on a fallback).
func (t *requestTrace) attemptFailed(target, kind string, status int) {
	if t == nil {
		return
	}
	t.mu.Lock()
	t.lastTarget = target
	t.mu.Unlock()
	text := target + " failed · " + kind
	if status > 0 {
		text += fmt.Sprintf(" (HTTP %d)", status)
	}
	t.event("attempt_failed", text)
}

// served records the attempt that answered.
func (t *requestTrace) served(target, account string, tokens int) {
	t.update(func(r *dtos.ConsoleRequest) {
		r.ServedBy, r.Account, r.Tokens = target, account, tokens
	})
}

// reject records why the gateway answered with an error; the last reason
// wins, since the final error response is the one the client saw.
func (t *requestTrace) reject(reason string) {
	t.update(func(r *dtos.ConsoleRequest) { r.Reason = reason })
}

// deferFinish hands closing the trace to a stream writer.
func (t *requestTrace) deferFinish() {
	if t == nil {
		return
	}
	t.mu.Lock()
	t.deferred = true
	t.mu.Unlock()
}

func (t *requestTrace) isDeferred() bool {
	if t == nil {
		return false
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.deferred
}

// finish closes the trace with the response status and writes it to the
// Console feed. Later calls do nothing.
func (t *requestTrace) finish(status int) {
	if t == nil {
		return
	}
	t.mu.Lock()
	if t.done {
		t.mu.Unlock()
		return
	}
	t.done = true
	r := t.req
	r.Status = status
	r.DurationMs = time.Since(t.start).Milliseconds()
	r.StartedAt = t.start.UTC().Format("2006-01-02T15:04:05.000Z07:00")
	routed, lastTarget := t.routed, t.lastTarget
	t.mu.Unlock()

	level, message := summarize(&r, routed, lastTarget)
	r.Events = append(r.Events, dtos.ConsoleEvent{OffsetMs: r.DurationMs, Kind: r.Outcome, Text: message})
	consolelog.PushEntry(dtos.ConsoleEntry{Level: level, Message: message, Request: &r}, t.start)
}

// summarize sets the outcome and returns the feed level and one-line message.
// A request refused before any upstream was tried is "rejected" (a warning:
// usually the client's mistake); an error after routing is "failed".
func summarize(r *dtos.ConsoleRequest, routed bool, lastTarget string) (dtos.LogLevel, string) {
	dur := formatDuration(r.DurationMs)
	switch {
	case r.Status < http.StatusBadRequest:
		r.Outcome = "completed"
		return dtos.LogLevelInfo, fmt.Sprintf("Completed · %s → %s · %d tokens · %s", r.Model, r.ServedBy, r.Tokens, dur)
	case !routed:
		r.Outcome = "rejected"
		return dtos.LogLevelWarn, "Rejected · " + r.Reason
	default:
		r.Outcome = "failed"
		target := lastTarget
		if target == "" {
			target = r.Model
		}
		return dtos.LogLevelError, "Failed · " + target + " · " + r.Reason
	}
}

func formatDuration(ms int64) string {
	if ms < 1000 {
		return fmt.Sprintf("%dms", ms)
	}
	return fmt.Sprintf("%.1fs", float64(ms)/1000)
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
