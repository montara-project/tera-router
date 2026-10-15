package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib/apperr"
)

// appSettingsKey is the settings row the dashboard's Settings page writes.
const appSettingsKey = "app"

const cavemanPrompt = `Respond terse like smart caveman. Keep all technical substance; drop filler, pleasantries, hedging, and restating the question. Short sentences or fragments are fine. Code, commands, paths, identifiers, numbers, and error text stay exact and complete.`

const tersePrompt = `Be concise. Answer directly with no preamble, no recap, and no closing summary. Use the fewest words that keep the answer complete and correct. Never shorten code, commands, or error text.`

const ponytailPrompt = `Write the minimum code that works. Before adding code, check whether it needs to exist, whether the codebase or standard library already does it, and whether one line suffices. No speculative abstractions, configuration, or scaffolding. Prefer deleting code to adding it. Keep explanations to a few short lines after the code.`

// loadAppSettings reads the dashboard settings document, falling back to the
// defaults when it has never been written.
func (s *Server) loadAppSettings(ctx context.Context) (dtos.AppSettings, error) {
	raw, err := s.app.Repos.Settings.Get(ctx, appSettingsKey)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return dtos.DefaultSettings(), nil
		}
		return dtos.AppSettings{}, err
	}
	return dtos.UnmarshalSettings([]byte(raw))
}

// applyTokenSaving runs the token-saving stages the operator enabled on the
// Settings page. Every stage is an optimization, so a failure leaves the
// request as it was instead of failing it.
func (s *Server) applyTokenSaving(ctx context.Context, req *core.ChatRequest) {
	st, err := s.loadAppSettings(ctx)
	if err != nil {
		s.log.Warn("token saving: load settings failed", "error", err)
		return
	}

	if on(st.HeadroomEnabled) {
		if err := s.headroomCompress(ctx, req, deref(st.HeadroomURL), deref(st.HeadroomTimeout)); err != nil {
			s.log.Warn("token saving: headroom failed open", "error", err)
		}
	}
	if on(st.RTKEnabled) {
		compressToolResults(req, deref(st.SourceCodeFilter))
	}
	req.System = appendDirectives(req.System, st)
}

// appendDirectives adds the output-shaping instructions after the client's
// system prompt. Caveman and Terse are alternatives, so Caveman wins when both
// are on; Ponytail layers on top of either.
func appendDirectives(system string, st dtos.AppSettings) string {
	var extra []string
	switch {
	case on(st.CavemanEnabled):
		extra = append(extra, cavemanPrompt)
	case on(st.TerseEnabled):
		extra = append(extra, tersePrompt)
	}
	if on(st.PonytailEnabled) {
		extra = append(extra, ponytailPrompt)
	}
	if len(extra) == 0 {
		return system
	}
	if strings.TrimSpace(system) != "" {
		extra = append([]string{system}, extra...)
	}
	return strings.Join(extra, "\n\n")
}

var ansiEscape = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

// compressToolResults is the RTK stage: it shrinks tool output text without
// dropping information — ANSI escapes, trailing whitespace, blank-line runs,
// and runs of identical lines collapse. The source code filter additionally
// strips whole-line comments ("minimal": //, "aggressive": also # and /* */).
func compressToolResults(req *core.ChatRequest, filter string) {
	for i := range req.Messages {
		for j := range req.Messages[i].Content {
			if tr := req.Messages[i].Content[j].ToolResult; tr != nil && tr.Content != "" {
				tr.Content = rtkCompress(tr.Content, filter)
			}
		}
	}
}

func rtkCompress(text, filter string) string {
	lines := strings.Split(ansiEscape.ReplaceAllString(text, ""), "\n")
	out := make([]string, 0, len(lines))
	prev, repeats, inBlock := "", 0, false

	flush := func() {
		if repeats > 0 {
			out = append(out, fmt.Sprintf("... (previous line repeated %d more times)", repeats))
			repeats = 0
		}
	}

	for _, line := range lines {
		line = strings.TrimRight(line, " \t\r")
		if dropComment(strings.TrimSpace(line), filter, &inBlock) {
			continue
		}
		if line == "" && len(out) > 0 && out[len(out)-1] == "" {
			continue
		}
		if line != "" && line == prev {
			repeats++
			continue
		}
		flush()
		out = append(out, line)
		prev = line
	}
	flush()
	return strings.Join(out, "\n")
}

// dropComment reports whether a trimmed line is a whole-line comment the
// filter mode removes. inBlock tracks an open /* */ block across lines.
func dropComment(t, filter string, inBlock *bool) bool {
	switch filter {
	case "minimal":
		return strings.HasPrefix(t, "//")
	case "aggressive":
		if *inBlock {
			*inBlock = !strings.Contains(t, "*/")
			return true
		}
		if strings.HasPrefix(t, "/*") {
			*inBlock = !strings.Contains(t, "*/")
			return true
		}
		return strings.HasPrefix(t, "//") || t == "#" || strings.HasPrefix(t, "# ")
	}
	return false
}

// headroomCompress sends the request's text tool results through a Headroom
// proxy's compress-only endpoint (POST /v1/compress) and writes the
// compressed text back. Only tool results are sent: they are the bulk of an
// agent's context, and the OpenAI tool-message shape round-trips them
// without converting the rest of the conversation.
func (s *Server) headroomCompress(ctx context.Context, req *core.ChatRequest, baseURL string, timeoutSec int) error {
	type toolMsg struct {
		Role       string `json:"role"`
		ToolCallID string `json:"tool_call_id"`
		Content    string `json:"content"`
	}
	var msgs []toolMsg
	var targets []*core.ToolResult
	for i := range req.Messages {
		for j := range req.Messages[i].Content {
			if tr := req.Messages[i].Content[j].ToolResult; tr != nil && tr.Content != "" {
				msgs = append(msgs, toolMsg{Role: "tool", ToolCallID: tr.CallID, Content: tr.Content})
				targets = append(targets, tr)
			}
		}
	}
	if len(msgs) == 0 {
		return nil
	}
	if baseURL == "" {
		return errors.New("headroom proxy URL is not set")
	}
	if timeoutSec <= 0 {
		timeoutSec = 5
	}

	body, err := json.Marshal(map[string]any{"model": req.Model, "messages": msgs})
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSec)*time.Second)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(baseURL, "/")+"/v1/compress", bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	// A Headroom bound beyond loopback (a compose sidecar) requires its token.
	if token := os.Getenv("HEADROOM_PROXY_TOKEN"); token != "" {
		httpReq.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("headroom returned %s", resp.Status)
	}

	var out struct {
		Messages []struct {
			Content json.RawMessage `json:"content"`
		} `json:"messages"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return err
	}
	if len(out.Messages) != len(targets) {
		return fmt.Errorf("headroom returned %d messages for %d sent", len(out.Messages), len(targets))
	}
	// Decode every message before writing any, so a malformed reply never
	// leaves the request half compressed.
	texts := make([]string, len(targets))
	for i, m := range out.Messages {
		if err := json.Unmarshal(m.Content, &texts[i]); err != nil {
			return fmt.Errorf("headroom message %d: %w", i, err)
		}
	}
	for i, tr := range targets {
		tr.Content = texts[i]
	}
	return nil
}

func on(b *bool) bool { return b != nil && *b }

func deref[T any](p *T) T {
	var zero T
	if p == nil {
		return zero
	}
	return *p
}
