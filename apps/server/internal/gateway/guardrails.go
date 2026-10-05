package gateway

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/guardrails"
	"tera-router/server/internal/models"

	"github.com/google/uuid"
)

// guardrailHeader tells the client which non-allow guardrail decision its
// request received (warn, log, or a PII masking strategy).
const guardrailHeader = "X-TeraRouter-Guardrails"

// guardrailVerdict is the outcome of screening one request.
type guardrailVerdict struct {
	// Decision is the strongest triggered action: allow, log, redact, mask,
	// hash, warn, or block.
	Decision string
	// Triggered lists the detector keys whose action fed the decision.
	Triggered []string
}

// screen runs the content-safety policies covering this request over its
// user-authored text. PII is masked in place on req; the merged decision is
// returned for the caller to enforce. Only user text parts are scanned:
// system prompts are operator-authored, and tool results and assistant turns
// are not user input.
//
// Provider and model policies apply when they match ANY candidate target, so
// fallback can only ever reach a target under at least that protection.
func (s *Server) screen(ctx context.Context, req *core.ChatRequest, resolved resolveResult, meta requestMeta) (guardrailVerdict, error) {
	allow := guardrailVerdict{Decision: "allow"}

	policies, err := s.app.Repos.Guardrails.ListEnabled(ctx)
	if err != nil || len(policies) == 0 {
		return allow, err
	}

	cfg := guardrails.Effective(policies, guardrailSubject(req.Model, resolved, meta))
	if !cfg.Active() {
		return allow, nil
	}

	text := userText(req)
	if strings.TrimSpace(text) == "" {
		return allow, nil
	}

	// No external detector engine is wired into the gateway, so every
	// detector runs natively.
	result := guardrails.Evaluate(cfg, false, text)
	verdict := guardrailVerdict{Decision: result.Decision}
	for _, d := range result.Detectors {
		if !d.Triggered {
			continue
		}
		verdict.Triggered = append(verdict.Triggered, d.Key)
		// PII masking applies whenever PII is found, even when a stronger
		// action (warn) outranks it in the decision.
		if d.Key == "pii" && verdict.Decision != "block" {
			redactUserText(req, cfg.Pii)
		}
	}
	return verdict, nil
}

// guardrailSubject collects the identifiers a request touches: its key, its
// chain, the requested model, and every candidate target.
func guardrailSubject(requested string, resolved resolveResult, meta requestMeta) guardrails.Subject {
	subject := guardrails.Subject{
		KeyID:  meta.APIKeyID,
		Chain:  resolved.ChainName,
		Models: []string{requested},
	}
	for _, t := range resolved.Targets {
		subject.Providers = append(subject.Providers, t.Provider)
		subject.Models = append(subject.Models, t.Model, t.Provider+"/"+t.Model)
		if t.Alias != "" {
			subject.Models = append(subject.Models, t.Alias)
		}
	}
	return subject
}

// userText joins the text parts of every user message.
func userText(req *core.ChatRequest) string {
	var b strings.Builder
	for _, m := range req.Messages {
		if m.Role != core.RoleUser {
			continue
		}
		for _, p := range m.Content {
			if p.Type == core.PartText && p.Text != "" {
				b.WriteString(p.Text)
				b.WriteByte('\n')
			}
		}
	}
	return b.String()
}

// redactUserText masks PII in every user text part in place. The request was
// parsed for this call alone, so nothing else shares these slices.
func redactUserText(req *core.ChatRequest, cfg guardrails.PiiConfig) {
	for i := range req.Messages {
		if req.Messages[i].Role != core.RoleUser {
			continue
		}
		parts := req.Messages[i].Content
		for j := range parts {
			if parts[j].Type == core.PartText {
				parts[j].Text = guardrails.Redact(cfg, parts[j].Text)
			}
		}
	}
}

// recordGuardrail appends a guardrail audit entry for a non-allow decision.
// The write runs in the background, tracked with the metering writes so a
// shutdown drains it too.
func (s *Server) recordGuardrail(meta requestMeta, model string, verdict guardrailVerdict) {
	detail, _ := json.Marshal(map[string]any{
		"decision":   verdict.Decision,
		"detectors":  verdict.Triggered,
		"key_id":     meta.APIKeyID,
		"chain":      meta.Chain,
		"request_id": meta.RequestID,
	})
	entry := models.AuditEntry{
		ID:     uuid.NewString(),
		Actor:  "key:" + meta.KeyName,
		Action: "guardrail." + verdict.Decision,
		Target: model,
		Detail: string(detail),
	}

	s.metering.Add(1)
	go func() {
		defer s.metering.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.app.Repos.Audit.Insert(ctx, entry); err != nil {
			s.log.Error("gateway record guardrail audit failed", "action", entry.Action, "error", err)
		}
	}()
}
