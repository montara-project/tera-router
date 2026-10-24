package gateway

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"
)

func strategyAccounts() []models.Account {
	return []models.Account{{ID: "a"}, {ID: "b"}, {ID: "c"}}
}

func firstID(accounts []models.Account) string { return accounts[0].ID }

func allUsable(string) bool { return true }

func TestAccountOrderFillFirstKeepsPriority(t *testing.T) {
	r := newAccountRotation()
	cfg := models.ProviderRouting{Strategy: models.AccountStrategyFillFirst}
	for range 4 {
		if got := firstID(r.order("p", strategyAccounts(), cfg, "", allUsable, time.Now())); got != "a" {
			t.Fatalf("fill first picked %q, want a", got)
		}
	}
}

func TestAccountOrderRoundRobinRotatesAfterStickyLimit(t *testing.T) {
	r := newAccountRotation()
	cfg := models.ProviderRouting{Strategy: models.AccountStrategyRoundRobin, StickyLimit: 2}
	want := []string{"a", "a", "b", "b", "c", "c", "a"}
	for i, w := range want {
		got := r.order("p", strategyAccounts(), cfg, "", allUsable, time.Now())
		if firstID(got) != w {
			t.Fatalf("request %d picked %q, want %q", i, firstID(got), w)
		}
		if len(got) != 3 {
			t.Fatalf("request %d kept %d accounts, want all 3 as fallbacks", i, len(got))
		}
	}
}

func TestAccountOrderSmartRoundRobinKeepsConversations(t *testing.T) {
	r := newAccountRotation()
	cfg := models.ProviderRouting{Strategy: models.AccountStrategySmartRoundRobin, StickyLimit: 1, AffinityHours: 1}
	now := time.Now()
	pick := func(session string, at time.Time) string {
		return firstID(r.order("p", strategyAccounts(), cfg, session, allUsable, at))
	}

	if got := pick("s1", now); got != "a" {
		t.Fatalf("s1 = %q, want a", got)
	}
	if got := pick("s2", now); got != "b" {
		t.Fatalf("new session s2 = %q, want b", got)
	}
	for range 3 {
		if got := pick("s1", now); got != "a" {
			t.Fatalf("s1 follow-up = %q, want a (affinity)", got)
		}
	}
	if got := pick("s3", now); got != "c" {
		t.Fatalf("new session s3 = %q, want c", got)
	}

	// Affinity slides with use, then lapses once the conversation goes quiet.
	if got := pick("s1", now.Add(50*time.Minute)); got != "a" {
		t.Fatalf("s1 within affinity = %q, want a", got)
	}
	// Expired: s1 counts as a new session (cursor 3 → a), so the next new
	// session moves on to b.
	later := now.Add(5 * time.Hour)
	if got := pick("s1", later); got != "a" {
		t.Fatalf("s1 after expiry = %q, want a fresh rotation (a)", got)
	}
	if got := pick("s4", later); got != "b" {
		t.Fatalf("s4 = %q, want b (expired s1 consumed a rotation)", got)
	}

	// A new session skips a cooled-down account when binding (cursor 5 → c).
	coolC := func(id string) bool { return id != "c" }
	if got := firstID(r.order("p", strategyAccounts(), cfg, "s5", coolC, later)); got != "a" {
		t.Fatalf("s5 with c cooled = %q, want a", got)
	}
}

func TestAccountOrderSmartRoundRobinRebindsMissingAccount(t *testing.T) {
	r := newAccountRotation()
	cfg := models.ProviderRouting{Strategy: models.AccountStrategySmartRoundRobin, StickyLimit: 1, AffinityHours: 24}
	now := time.Now()
	if got := firstID(r.order("p", strategyAccounts(), cfg, "s", allUsable, now)); got != "a" {
		t.Fatalf("s = %q, want a", got)
	}
	// Account a was disabled: the conversation moves and sticks to the next one.
	rest := []models.Account{{ID: "b"}, {ID: "c"}}
	moved := firstID(r.order("p", rest, cfg, "s", allUsable, now))
	if moved == "a" {
		t.Fatalf("s still bound to removed account")
	}
	if got := firstID(r.order("p", rest, cfg, "s", allUsable, now)); got != moved {
		t.Fatalf("s = %q after rebind, want %q", got, moved)
	}
}

func TestSessionKey(t *testing.T) {
	msg := func(role core.Role, text string) core.Message {
		return core.Message{Role: role, Content: []core.ContentPart{{Type: core.PartText, Text: text}}}
	}
	turn1 := &core.ChatRequest{
		System:   "sys",
		Messages: []core.Message{msg(core.RoleUser, "hello")},
		Metadata: core.RequestMetadata{APIKeyID: "k1"},
	}
	turn2 := &core.ChatRequest{
		System:   "sys",
		Messages: []core.Message{msg(core.RoleUser, "hello"), msg(core.RoleAssistant, "hi"), msg(core.RoleUser, "more")},
		Metadata: core.RequestMetadata{APIKeyID: "k1"},
	}
	if sessionKey(turn1) == "" || sessionKey(turn1) != sessionKey(turn2) {
		t.Fatalf("turns of one conversation got different keys")
	}

	other := *turn1
	other.Messages = []core.Message{msg(core.RoleUser, "different task")}
	if sessionKey(&other) == sessionKey(turn1) {
		t.Fatalf("different openings share a key")
	}

	otherKey := *turn1
	otherKey.Metadata.APIKeyID = "k2"
	if sessionKey(&otherKey) == sessionKey(turn1) {
		t.Fatalf("different API keys share a key")
	}

	named := func(userID string) *core.ChatRequest {
		meta, _ := json.Marshal(map[string]string{"user_id": userID})
		return &core.ChatRequest{
			Messages: []core.Message{msg(core.RoleUser, "same opening")},
			Extra:    map[string]json.RawMessage{"metadata": meta},
			Metadata: core.RequestMetadata{APIKeyID: "k1"},
		}
	}
	if sessionKey(named("session-1")) == sessionKey(named("session-2")) {
		t.Fatalf("client session ids ignored")
	}

	if got := sessionKey(&core.ChatRequest{}); got != "" {
		t.Fatalf("empty request key = %q, want empty", got)
	}
}

func TestAccountStrategyRouterDefaultFollowsSettings(t *testing.T) {
	srv, application := newTestServer(t)
	ctx := context.Background()

	// Defaults: provider round robin on, sticky limit 3.
	if got := srv.accountStrategy(ctx, "openai"); got.Strategy != models.AccountStrategyRoundRobin || got.StickyLimit != 3 {
		t.Fatalf("default strategy = %+v, want round robin / 3", got)
	}

	if err := application.Repos.Settings.Upsert(ctx, appSettingsKey, `{"provider_round_robin":false}`); err != nil {
		t.Fatal(err)
	}
	if got := srv.accountStrategy(ctx, "openai"); got.Strategy != models.AccountStrategyFillFirst {
		t.Fatalf("strategy with round robin off = %+v, want fill first", got)
	}

	smart := models.ProviderRouting{Strategy: models.AccountStrategySmartRoundRobin, StickyLimit: 2, AffinityHours: 6}
	if err := application.Repos.Settings.SetProviderRouting(ctx, "openai", smart); err != nil {
		t.Fatal(err)
	}
	if got := srv.accountStrategy(ctx, "openai"); got != smart {
		t.Fatalf("provider override = %+v, want %+v", got, smart)
	}
}
