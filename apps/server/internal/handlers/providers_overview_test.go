package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"tera-router/server/internal/dtos"
)

// TestProvidersOverviewFilters pins that the providers page and the connect
// dialog get their search, capability filter and page from the server, with
// counts that still cover every provider.
func TestProvidersOverviewFilters(t *testing.T) {
	h := newBackupHarness(t, "test-secret")
	if _, err := h.app.Repos.DB.Exec(`INSERT INTO accounts (id, provider, label, auth_kind) VALUES
		('acc-1', 'openai', 'A', 'api_key'), ('acc-2', 'anthropic', 'B', 'api_key')`); err != nil {
		t.Fatal(err)
	}
	h.fiber.Get("/providers", (&providersHandler{app: h.app}).Index)
	h.fiber.Get("/media", (&mediaHandler{app: h.app}).Index)

	overview := func(query string) dtos.ProviderOverview {
		t.Helper()
		status, raw := h.do(t, httptest.NewRequest(http.MethodGet, "/providers"+query, nil))
		if status != http.StatusOK {
			t.Fatalf("GET /providers%s = %d (%s)", query, status, raw)
		}
		var res struct {
			Data dtos.ProviderOverview `json:"data"`
		}
		if err := json.Unmarshal(raw, &res); err != nil {
			t.Fatal(err)
		}
		return res.Data
	}
	slugs := func(rows []dtos.ProviderView) []string {
		out := make([]string, 0, len(rows))
		for _, r := range rows {
			out = append(out, r.Slug)
		}
		slices.Sort(out)
		return out
	}

	whole := overview("")
	if got := slugs(whole.Connected); !slices.Equal(got, []string{"anthropic", "openai"}) {
		t.Fatalf("connected = %v, want anthropic and openai", got)
	}
	if whole.ConnectedCount != 2 || whole.ConnectedTotal != 2 || whole.AvailableCount != len(whole.Available) {
		t.Errorf("whole counts = %+v", whole)
	}

	found := overview("?search=OPENAI")
	if got := slugs(found.Connected); !slices.Equal(got, []string{"openai"}) {
		t.Errorf("search=OPENAI connected = %v, want openai", got)
	}
	if found.ConnectedTotal != 1 || found.ConnectedCount != 2 || found.AvailableCount != whole.AvailableCount {
		t.Errorf("search counts = total %d, connected %d, available %d; the counts must ignore the search", found.ConnectedTotal, found.ConnectedCount, found.AvailableCount)
	}
	for _, p := range found.Available {
		if !strings.Contains(strings.ToLower(p.Name+" "+p.Slug), "openai") {
			t.Errorf("search=OPENAI kept available provider %q", p.Slug)
		}
	}

	for _, p := range overview("?capability=search").Available {
		if !slices.Contains(p.Capabilities, "search") {
			t.Errorf("capability=search kept %q with %v", p.Slug, p.Capabilities)
		}
	}

	page := overview("?limit=1&offset=1")
	if len(page.Connected) != 1 || page.ConnectedTotal != 2 {
		t.Errorf("page = %d connected, total %d; want 1 of 2", len(page.Connected), page.ConnectedTotal)
	}

	// Media: one kind, searched, and split by whether an account is attached.
	_, raw := h.do(t, httptest.NewRequest(http.MethodGet, "/media?capability=embed&search=open", nil))
	var media struct {
		Data struct {
			Providers []dtos.MediaProvider `json:"providers"`
			Connected []dtos.MediaProvider `json:"connected"`
			Available []dtos.MediaProvider `json:"available"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &media); err != nil {
		t.Fatal(err)
	}
	if len(media.Data.Providers) == 0 || len(media.Data.Connected)+len(media.Data.Available) != len(media.Data.Providers) {
		t.Fatalf("media = %d providers, %d connected, %d available", len(media.Data.Providers), len(media.Data.Connected), len(media.Data.Available))
	}
	for _, p := range media.Data.Providers {
		if !slices.Contains(p.Capabilities, "embed") {
			t.Errorf("capability=embed kept %q with %v", p.Slug, p.Capabilities)
		}
	}
	connected := false
	for _, p := range media.Data.Connected {
		connected = connected || p.Slug == "openai"
	}
	if !connected {
		t.Errorf("openai has an account and embeddings, but media connected = %v", media.Data.Connected)
	}
}
