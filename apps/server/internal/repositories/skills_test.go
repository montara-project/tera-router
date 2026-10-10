package repositories_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
)

// Deleting a skill removes it from every API key that selected it and leaves
// the keys' other selections, and their order, untouched.
func TestSkillDeleteStripsKeySelections(t *testing.T) {
	repos := newProviderRepos(t)
	ctx := context.Background()

	for _, id := range []string{"keep-a", "gone", "keep-b"} {
		if err := repos.Skills.Insert(ctx, models.Skill{ID: id, Name: id, Prompt: id}); err != nil {
			t.Fatalf("insert skill %s: %v", id, err)
		}
	}
	keys := map[string][]string{
		"both":  {"keep-a", "gone", "keep-b"},
		"only":  {"gone"},
		"other": {"keep-b"},
		"none":  nil,
	}
	for id, skillIDs := range keys {
		key := models.APIKey{ID: id, Name: id, KeyHash: "h", LookupHash: "lookup-" + id, Display: id, SkillIDs: skillIDs}
		if err := repos.APIKeys.Insert(ctx, key); err != nil {
			t.Fatalf("insert key %s: %v", id, err)
		}
	}

	if err := repos.Skills.Delete(ctx, "gone"); err != nil {
		t.Fatalf("delete skill: %v", err)
	}

	want := map[string][]string{
		"both":  {"keep-a", "keep-b"},
		"only":  {},
		"other": {"keep-b"},
		"none":  {},
	}
	for id, wantIDs := range want {
		key, err := repos.APIKeys.Get(ctx, id)
		if err != nil {
			t.Fatalf("get key %s: %v", id, err)
		}
		if !slices.Equal(key.SkillIDs, wantIDs) {
			t.Errorf("key %s: skill_ids = %v, want %v", id, key.SkillIDs, wantIDs)
		}
	}
	if _, err := repos.Skills.Get(ctx, "gone"); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("deleted skill still readable: %v", err)
	}
}

// A missing skill is reported as not found and touches no key.
func TestSkillDeleteMissingIsNotFound(t *testing.T) {
	repos := newProviderRepos(t)
	if err := repos.Skills.Delete(context.Background(), "nope"); !errors.Is(err, apperr.ErrNotFound) {
		t.Errorf("Delete(missing) = %v, want not found", err)
	}
}
