package handlers

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	tera "tera-router/server/internal/app"
	"tera-router/server/internal/gateway"

	"github.com/gofiber/fiber/v3"
)

// The Endpoints page must document exactly the gateway's routes: a key-gated
// route that is not a gateway path is a documented route that does not exist,
// and a gateway route missing here is one the page hides.
func TestAPIReferenceMatchesGateway(t *testing.T) {
	seen := map[string]bool{}
	var gated []string
	for _, g := range apiReference {
		for _, r := range g.Routes {
			key := r.Method + " " + r.Path
			if seen[key] {
				t.Errorf("duplicate route %s", key)
			}
			seen[key] = true
			if g.Auth {
				gated = append(gated, r.Path)
			}
		}
	}

	for _, path := range gateway.GatewayRoutes {
		if !slices.Contains(gated, path) {
			t.Errorf("gateway route %s missing from the Endpoints reference", path)
		}
	}
	for _, path := range gated {
		if !gateway.IsGatewayPath(path) {
			t.Errorf("documented route %s is not served by the gateway", path)
		}
	}
}

// The Public group is the only one without a key, and it must hold the
// unauthenticated routes registered outside the gateway.
func TestAPIReferencePublicGroup(t *testing.T) {
	var public []string
	for _, g := range apiReference {
		if !g.Auth {
			for _, r := range g.Routes {
				public = append(public, r.Path)
			}
		}
	}
	want := []string{"/health", "/skills/:slug/SKILL.md"}
	if !slices.Equal(public, want) {
		t.Errorf("public routes = %v, want %v", public, want)
	}
}

// With no API_URL configured the catalog carries the origin the request
// arrived on, so the page shows the address the browser is actually using.
func TestEndpointsCatalogBaseURL(t *testing.T) {
	app := fiber.New()
	app.Get("/endpoints", (&endpointsHandler{app: &tera.Application{}}).Catalog)
	req := httptest.NewRequest("GET", "http://router.example.com/endpoints", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(resp.Body)
	var body struct {
		Data struct {
			BaseURL string `json:"base_url"`
			Groups  []struct {
				Title  string `json:"title"`
				Routes []struct {
					Path string `json:"path"`
				} `json:"routes"`
			} `json:"groups"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("decode %s: %v", raw, err)
	}
	if body.Data.BaseURL != "http://router.example.com" {
		t.Errorf("base_url = %q", body.Data.BaseURL)
	}
	titles := make([]string, 0, len(body.Data.Groups))
	for _, g := range body.Data.Groups {
		titles = append(titles, g.Title)
	}
	if got := strings.Join(titles, ","); got != "Text generation,Media and tools,Models and usage,Public" {
		t.Errorf("groups = %s", got)
	}
}
