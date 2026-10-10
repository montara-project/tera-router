package gateway

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"
)

func TestAppendSkills(t *testing.T) {
	skills := []models.Skill{{Prompt: " Be brief. "}, {Prompt: "   "}, {Prompt: "Answer in English."}}
	cases := []struct{ name, system, want string }{
		{"after client system", "You are helpful.", "You are helpful.\n\nBe brief.\n\nAnswer in English."},
		{"no client system", "", "Be brief.\n\nAnswer in English."},
	}
	for _, tc := range cases {
		if got := appendSkills(tc.system, skills); got != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
	if got := appendSkills("keep", nil); got != "keep" {
		t.Errorf("no skills: got %q, want %q", got, "keep")
	}
}

// A request gets the globally enabled skills plus the ones its own key
// selected — oldest first, each once, and never another key's selection.
func TestInjectSkillsPerKey(t *testing.T) {
	srv, a := newTestServer(t)
	exec(t, a, `INSERT INTO skills (id, name, prompt, enabled, created_at) VALUES
		('global', 'g', 'Global.', 1, '2026-01-02 00:00:00.000+00:00'),
		('mine', 'm', 'Mine.', 0, '2026-01-01 00:00:00.000+00:00'),
		('theirs', 't', 'Theirs.', 0, '2026-01-03 00:00:00.000+00:00')`)
	exec(t, a, `INSERT INTO api_keys (id, name, key_hash, lookup_hash, display, skill_ids) VALUES
		('k1', 'one', 'h1', 'l1', 'd1', '["mine","global","gone"]'),
		('k2', 'two', 'h2', 'l2', 'd2', '["theirs"]'),
		('k3', 'three', 'h3', 'l3', 'd3', '[]')`)

	cases := map[string]string{
		"k1":      "Base.\n\nMine.\n\nGlobal.",
		"k2":      "Base.\n\nGlobal.\n\nTheirs.",
		"k3":      "Base.\n\nGlobal.",
		"unknown": "Base.\n\nGlobal.",
	}
	for keyID, want := range cases {
		req := &core.ChatRequest{System: "Base."}
		if err := srv.injectSkills(context.Background(), req, keyID); err != nil {
			t.Fatalf("injectSkills(%s): %v", keyID, err)
		}
		if req.System != want {
			t.Errorf("key %s: System = %q, want %q", keyID, req.System, want)
		}
	}
}

// End to end: a globally enabled skill and one selected on the calling API key
// are both in the body the upstream receives, after the client's own system
// message.
func TestEnabledSkillReachesUpstream(t *testing.T) {
	app, a := newGatewayApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"c1","object":"chat.completion","model":"gpt-4o",
			"choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],
			"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
	})
	registerProvider(t, a, "fake", upstream.server.URL, "sk-upstream-secret")
	exec(t, a, `INSERT INTO skills (id, name, prompt, enabled) VALUES
		('on', 'on', 'Always answer in French.', 1), ('off', 'off', 'Never sent.', 0),
		('picked', 'picked', 'Cite sources.', 0)`)
	exec(t, a, `UPDATE api_keys SET skill_ids = '["picked"]' WHERE id = 'key-e2e'`)

	resp := do(t, app, http.MethodPost, "/v1/chat/completions",
		`{"model":"fake/gpt-4o","messages":[{"role":"system","content":"Be brief."},{"role":"user","content":"hi"}]}`,
		map[string]string{"Authorization": "Bearer " + testKeyPlaintext})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", resp.StatusCode, readBody(t, resp))
	}

	sent := upstream.captured()
	if len(sent) != 1 {
		t.Fatalf("upstream got %d requests, want 1", len(sent))
	}
	if !strings.Contains(sent[0].Raw, `Be brief.\n\nAlways answer in French.`) {
		t.Errorf("upstream body lacks the injected skill after the client system prompt: %s", sent[0].Raw)
	}
	if !strings.Contains(sent[0].Raw, "Cite sources.") {
		t.Errorf("upstream body lacks the skill selected on the API key: %s", sent[0].Raw)
	}
	if strings.Contains(sent[0].Raw, "Never sent.") {
		t.Errorf("a disabled skill was injected: %s", sent[0].Raw)
	}
}
