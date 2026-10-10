package handlers

import (
	"strings"
	"testing"

	"tera-router/server/internal/models"
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
