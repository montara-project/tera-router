package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/dtos"
	"tera-router/server/internal/middlewares"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
)

// TestCustomModelTestStream pins the SSE contract the playground reads: a
// "delta" event per upstream fragment, then one "done" event with the result.
func TestCustomModelTestStream(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"Hi \"}}]}\n\n" +
			"data: {\"choices\":[{\"delta\":{\"content\":\"there\"}}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":2}}\n\n" +
			"data: [DONE]\n\n"))
	}))
	defer upstream.Close()

	a, _ := newSeedHarness(t)
	a.Services = &services.Services{Upstream: &services.UpstreamService{}}
	const id = "11111111-1111-1111-1111-111111111111"
	if _, err := a.Repos.DB.Exec(`INSERT INTO custom_providers (id, name, slug, base_url, api_kind) VALUES (?, 'Local', 'local-llm', ?, 'openai')`,
		id, upstream.URL+"/v1"); err != nil {
		t.Fatal(err)
	}

	h := &providersHandler{app: a}
	f := fiber.New(fiber.Config{ErrorHandler: middlewares.ErrorHandler})
	f.Post("/custom-providers/:id/models/test", h.CustomModelTest)

	req := httptest.NewRequest("POST", "/custom-providers/"+id+"/models/test",
		strings.NewReader(`{"model":"m","stream":true,"messages":[{"role":"user","content":"hi"}]}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := f.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content-type = %q", ct)
	}
	raw, _ := io.ReadAll(resp.Body)

	var events []dtos.ModelTestStreamEvent
	for _, line := range strings.Split(string(raw), "\n") {
		if data, ok := strings.CutPrefix(line, "data: "); ok {
			var ev dtos.ModelTestStreamEvent
			if err := json.Unmarshal([]byte(data), &ev); err != nil {
				t.Fatalf("bad event %q: %v", data, err)
			}
			events = append(events, ev)
		}
	}
	if len(events) != 3 || events[0].Text != "Hi " || events[1].Text != "there" || events[2].Type != "done" {
		t.Fatalf("events = %+v", events)
	}
	if r := events[2].Result; r == nil || !r.OK || r.Content != "Hi there" || r.OutputTokens != 2 {
		t.Fatalf("done result = %+v", r)
	}
}
