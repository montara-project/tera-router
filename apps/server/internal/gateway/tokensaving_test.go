package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/core"
)

func TestRTKCompress(t *testing.T) {
	in := "\x1b[32mok\x1b[0m  \nsame\nsame\nsame\n\n\n\n// note\ncode()\n/* block\n still */\n# hash\nend"
	cases := map[string]string{
		"off":        "ok\nsame\n... (previous line repeated 2 more times)\n\n// note\ncode()\n/* block\n still */\n# hash\nend",
		"minimal":    "ok\nsame\n... (previous line repeated 2 more times)\n\ncode()\n/* block\n still */\n# hash\nend",
		"aggressive": "ok\nsame\n... (previous line repeated 2 more times)\n\ncode()\nend",
	}
	for filter, want := range cases {
		if got := rtkCompress(in, filter); got != want {
			t.Errorf("%s:\n got %q\nwant %q", filter, got, want)
		}
	}
}

// The enabled toggles in the stored settings document reach the request:
// Caveman beats Terse, Ponytail layers on, RTK slims tool results, and
// Headroom's compressed text replaces the original.
func TestApplyTokenSaving(t *testing.T) {
	headroom := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/compress" {
			http.NotFound(w, r)
			return
		}
		var body struct {
			Messages []map[string]string `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		for _, m := range body.Messages {
			m["content"] = "hr:" + m["content"]
		}
		_ = json.NewEncoder(w).Encode(body)
	}))
	defer headroom.Close()

	srv, a := newTestServer(t)
	exec(t, a, `INSERT INTO settings (key, value) VALUES ('app', '{"rtk_enabled":true,"caveman_enabled":true,
		"terse_enabled":true,"ponytail_enabled":true,"headroom_enabled":true,"headroom_url":"`+headroom.URL+`"}')
		ON CONFLICT (key) DO UPDATE SET value = excluded.value`)

	req := &core.ChatRequest{System: "Base.", Messages: []core.Message{{Role: core.RoleTool, Content: []core.ContentPart{
		{Type: core.PartToolResult, ToolResult: &core.ToolResult{CallID: "c1", Content: "a\na\na\n"}},
	}}}}
	srv.applyTokenSaving(context.Background(), req)

	if got := req.Messages[0].Content[0].ToolResult.Content; got != "hr:a\na\n... (previous line repeated 1 more times)\n" {
		t.Errorf("tool result = %q", got)
	}
	if want := "Base.\n\n" + cavemanPrompt + "\n\n" + ponytailPrompt; req.System != want {
		t.Errorf("System = %q", req.System)
	}

	// A dead proxy fails open: the request keeps its text.
	headroom.Close()
	req.Messages[0].Content[0].ToolResult.Content = "x"
	srv.applyTokenSaving(context.Background(), req)
	if got := req.Messages[0].Content[0].ToolResult.Content; got != "x" {
		t.Errorf("fail-open tool result = %q", got)
	}
	if strings.Count(req.System, cavemanPrompt) != 2 {
		t.Errorf("directives not applied on second pass")
	}
}
