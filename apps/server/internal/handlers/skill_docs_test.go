package handlers

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

func TestRenderSkill(t *testing.T) {
	got := renderSkill(models.Skill{
		Name:        `Reviewer: "strict"`,
		Description: "line one\nline two",
		Prompt:      "  Prefer small diffs.\n\n",
	})
	want := "---\nname: \"Reviewer: \\\"strict\\\"\"\ndescription: \"line one\\nline two\"\n---\n\nPrefer small diffs.\n"
	if got != want {
		t.Errorf("renderSkill =\n%q\nwant\n%q", got, want)
	}
}

// Every guide must link only to guides that ship, or agents follow dead URLs.
func TestReferenceSkillLinksResolve(t *testing.T) {
	entries, err := referenceSkills.ReadDir("skilldocs")
	if err != nil || len(entries) == 0 {
		t.Fatalf("no embedded reference skills: %v", err)
	}
	for _, e := range entries {
		raw, _ := referenceSkills.ReadFile("skilldocs/" + e.Name())
		for _, part := range strings.Split(string(raw), "{{BASE_URL}}/skills/")[1:] {
			slug, _, _ := strings.Cut(part, "/")
			if _, err := referenceSkills.ReadFile("skilldocs/" + slug + ".md"); err != nil {
				t.Errorf("%s links to missing skill %q", e.Name(), slug)
			}
		}
	}
}

// A forged Host header must not end up in the guide that tells an agent where
// to send its API key once the router knows its own address.
func TestSkillDocumentUsesConfiguredBaseURL(t *testing.T) {
	entries, err := referenceSkills.ReadDir("skilldocs")
	if err != nil || len(entries) == 0 {
		t.Fatalf("no reference skills: %v", err)
	}
	slug := strings.TrimSuffix(entries[0].Name(), ".md")

	fetch := func(apiURL string) (string, string) {
		h := &skillsHandler{app: &app.Application{Config: config.Config{App: config.ConfigApp{APIURL: apiURL}}}}
		f := fiber.New()
		f.Get("/skills/:slug/SKILL.md", h.Document)
		req := httptest.NewRequest("GET", "/skills/"+slug+"/SKILL.md", nil)
		req.Host = "evil.example"
		resp, err := f.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(resp.Body)
		return string(body), resp.Header.Get("Cache-Control")
	}

	doc, _ := fetch("https://router.example/")
	if strings.Contains(doc, "evil.example") || !strings.Contains(doc, "https://router.example/v1") {
		t.Errorf("document does not use the configured API_URL")
	}
	if _, cache := fetch(""); cache != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store", cache)
	}
}
