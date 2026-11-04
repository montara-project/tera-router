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

// tokenSaving records what the token-saving stages did to one request, so
// the usage rows can attribute the savings on the dashboard.
type tokenSaving struct {
	// PromptReducedBytes is how many bytes input compression removed from the
	// tool results.
	PromptReducedBytes int
	// OutputShaped is true when an output-shaping directive was appended.
	OutputShaped bool
	// Rules attributes the removed bytes: "headroom" for the Headroom proxy,
	// otherwise the RTK rule that removed them (see rtk* constants).
	Rules map[string]int
	// Directives names the output-shaping directives appended (caveman,
	// terse, ponytail).
	Directives []string
}

// RTK rule names, as stored per request and shown on the Usage page.
const (
	rtkANSI        = "ansi_escapes"
	rtkTrailing    = "trailing_whitespace"
	rtkBlankLines  = "blank_lines"
	rtkRepeats     = "repeated_lines"
	rtkComments    = "comments"
	savingHeadroom = "headroom"
)

// applyTokenSaving runs the token-saving stages the operator enabled on the
// Settings page. Every stage is an optimization, so a failure leaves the
// request as it was instead of failing it.
func (s *Server) applyTokenSaving(ctx context.Context, req *core.ChatRequest) tokenSaving {
	st, err := s.loadAppSettings(ctx)
	if err != nil {
		s.log.Warn("token saving: load settings failed", "error", err)
		return tokenSaving{}
	}

	before := toolResultBytes(req)
	rules := map[string]int{}
	if on(st.HeadroomEnabled) {
		if err := s.headroomCompress(ctx, req, deref(st.HeadroomURL), deref(st.HeadroomTimeout)); err != nil {
			s.log.Warn("token saving: headroom failed open", "error", err)
		}
		rules[savingHeadroom] = before - toolResultBytes(req)
	}
	if on(st.RTKEnabled) {
		compressToolResults(req, deref(st.SourceCodeFilter), rules)
	}
	for rule, n := range rules {
		if n <= 0 {
			delete(rules, rule)
		}
	}
	names := directiveNames(st)
	req.System = appendDirectives(req.System, names)
	return tokenSaving{
		PromptReducedBytes: max(before-toolResultBytes(req), 0),
		OutputShaped:       len(names) > 0,
		Rules:              rules,
		Directives:         names,
	}
}

// toolResultBytes sums the text of every tool result, the part of the request
// input compression rewrites.
func toolResultBytes(req *core.ChatRequest) int {
	n := 0
	for i := range req.Messages {
		for j := range req.Messages[i].Content {
			if tr := req.Messages[i].Content[j].ToolResult; tr != nil {
				n += len(tr.Content)
			}
		}
	}
	return n
}

// directivePrompts maps each output-shaping directive to its instruction.
var directivePrompts = map[string]string{
	"caveman":  cavemanPrompt,
	"terse":    tersePrompt,
	"ponytail": ponytailPrompt,
}

// directiveNames lists the output-shaping directives the settings enable, in
// the order they are appended. Caveman and Terse are alternatives, so Caveman
// wins when both are on; Ponytail layers on top of either.
func directiveNames(st dtos.AppSettings) []string {
	var names []string
	switch {
	case on(st.CavemanEnabled):
		names = append(names, "caveman")
	case on(st.TerseEnabled):
		names = append(names, "terse")
	}
	if on(st.PonytailEnabled) {
		names = append(names, "ponytail")
	}
	return names
}

// appendDirectives adds the named directives' instructions after the
// client's system prompt.
func appendDirectives(system string, names []string) string {
	if len(names) == 0 {
		return system
	}
	extra := make([]string, 0, len(names)+1)
	if strings.TrimSpace(system) != "" {
		extra = append(extra, system)
	}
	for _, name := range names {
		extra = append(extra, directivePrompts[name])
	}
	return strings.Join(extra, "\n\n")
}

var ansiEscape = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

// compressToolResults is the RTK stage: it shrinks tool output text without
// dropping information — ANSI escapes, trailing whitespace, blank-line runs,
// and runs of identical lines collapse. The source code filter additionally
// strips whole-line comments ("minimal": //, "aggressive": also # and /* */).
// Bytes removed are added to removed per rule.
func compressToolResults(req *core.ChatRequest, filter string, removed map[string]int) {
	for i := range req.Messages {
		for j := range req.Messages[i].Content {
			if tr := req.Messages[i].Content[j].ToolResult; tr != nil && tr.Content != "" {
				tr.Content = rtkCompress(tr.Content, filter, removed)
			}
		}
	}
}

// rtkCompress rewrites one tool result. When removed is non-nil it adds the
// bytes each rule removed; a collapsed run is credited net of the summary
// line that replaces it.
func rtkCompress(text, filter string, removed map[string]int) string {
	credit := func(rule string, n int) {
		if removed != nil {
			removed[rule] += n
		}
	}
	stripped := ansiEscape.ReplaceAllString(text, "")
	credit(rtkANSI, len(text)-len(stripped))

	lines := strings.Split(stripped, "\n")
	out := make([]string, 0, len(lines))
	prev, repeats, inBlock := "", 0, false

	flush := func() {
		if repeats > 0 {
			summary := fmt.Sprintf("... (previous line repeated %d more times)", repeats)
			out = append(out, summary)
			credit(rtkRepeats, -(len(summary) + 1))
			repeats = 0
		}
	}

	for _, raw := range lines {
		line := strings.TrimRight(raw, " \t\r")
		credit(rtkTrailing, len(raw)-len(line))
		if dropComment(strings.TrimSpace(line), filter, &inBlock) {
			credit(rtkComments, len(line)+1)
			continue
		}
		if line == "" && len(out) > 0 && out[len(out)-1] == "" {
			credit(rtkBlankLines, 1)
			continue
		}
		if line != "" && line == prev {
			repeats++
			credit(rtkRepeats, len(line)+1)
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
