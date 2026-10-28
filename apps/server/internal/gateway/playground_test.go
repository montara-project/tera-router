package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"tera-router/server/internal/modelcatalog"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

// newPlaygroundApp mounts the playground routes the way the dashboard does,
// minus its JWT middleware.
func newPlaygroundApp(t *testing.T) (*fiber.App, *Server) {
	t.Helper()
	_, application := newTestServer(t)
	fiberApp := fiber.New()
	srv := New(application)
	t.Cleanup(srv.Drain)
	fiberApp.Get("/v1/playground/models", srv.PlaygroundModels)
	fiberApp.Post("/v1/playground/chat", srv.PlaygroundChat)
	return fiberApp, srv
}

// The playground lists usable providers' active catalog models as
// provider/model, then aliases and chains.
func TestPlaygroundModels(t *testing.T) {
	fiberApp, srv := newPlaygroundApp(t)
	a := srv.app
	ctx := context.Background()
	registerProvider(t, a, "fake", "http://127.0.0.1:1", "sk-upstream")
	if _, err := modelcatalog.Store(ctx, a.Repos.Settings, "fake", []string{"m1", "m2"}); err != nil {
		t.Fatal(err)
	}
	if _, err := modelcatalog.SetStates(ctx, a.Repos.Settings, "fake", []modelcatalog.StateUpdate{{ID: "m2", State: modelcatalog.StateDisabled}}); err != nil {
		t.Fatal(err)
	}
	if err := a.Repos.Aliases.Upsert(ctx, models.ModelAlias{
		ID: "alias-1", Name: "fast", Active: true,
		Targets: []models.AliasTarget{{ID: "at-1", Provider: "fake", Model: "m1", Active: true}},
	}); err != nil {
		t.Fatal(err)
	}
	if err := a.Repos.Chains.Insert(ctx, models.Chain{ID: "chain-1", Name: "safe", Strategy: "priority", Enabled: true,
		Steps: []models.ChainStep{{ID: "cs-1", Provider: "fake", Model: "m1", Active: true}}}); err != nil {
		t.Fatal(err)
	}

	resp := do(t, fiberApp, http.MethodGet, "/v1/playground/models", "", nil)
	var body struct {
		Data []modelEntry `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, m := range body.Data {
		got = append(got, m.OwnedBy+":"+m.ID)
	}
	if want := "fake:fake/m1 alias:fast chain:safe"; strings.Join(got, " ") != want {
		t.Fatalf("models = %q, want %q", got, want)
	}
}

// A playground chat needs no API key and routes like gateway traffic: an
// alias resolves to its provider target.
func TestPlaygroundChatRoutesAlias(t *testing.T) {
	fiberApp, srv := newPlaygroundApp(t)
	upstream := newFakeUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"x","model":"m1","choices":[{"index":0,"message":{"role":"assistant","content":"pong"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`))
	})
	registerProvider(t, srv.app, "fake", upstream.server.URL, "sk-upstream")
	if err := srv.app.Repos.Aliases.Upsert(context.Background(), models.ModelAlias{
		ID: "alias-1", Name: "fast", Active: true,
		Targets: []models.AliasTarget{{ID: "at-1", Provider: "fake", Model: "m1", Active: true}},
	}); err != nil {
		t.Fatal(err)
	}

	resp := do(t, fiberApp, http.MethodPost, "/v1/playground/chat",
		`{"model":"fast","messages":[{"role":"user","content":"ping"}]}`, nil)
	body := readBody(t, resp)
	if resp.StatusCode != http.StatusOK || !strings.Contains(body, "pong") {
		t.Fatalf("status %d, body %s", resp.StatusCode, body)
	}
	if reqs := upstream.captured(); len(reqs) != 1 || reqs[0].Body["model"] != "m1" {
		t.Fatalf("upstream requests = %+v", reqs)
	}
}
