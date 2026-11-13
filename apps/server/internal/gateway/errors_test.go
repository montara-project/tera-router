package gateway

import (
	"testing"
	"time"

	"tera-router/server/internal/core"
)

// TestShouldRetrySameAccount pins the per-kind retry decision: a transient
// upstream fault is retried on the same account, an account the upstream itself
// restricted is not — retrying only adds traffic to an account that was just
// flagged.
func TestShouldRetrySameAccount(t *testing.T) {
	cases := map[core.ErrorKind]bool{
		core.ErrUpstream:          true,
		core.ErrTimeout:           true,
		core.ErrAccountRestricted: false,
		core.ErrAuth:              false,
		core.ErrAccountSuspended:  false,
		core.ErrBadRequest:        false,
		core.ErrRateLimit:         false,
	}
	for kind, want := range cases {
		if got := shouldRetrySameAccount(&core.ProviderError{Kind: kind}); got != want {
			t.Errorf("retry same account for %s = %v, want %v", kind, got, want)
		}
	}
	if shouldRetrySameAccount(nil) {
		t.Error("a nil error was retried")
	}
}

// TestNoteFailureParksRestrictedAccount pins that a restricted account is
// parked for the long cooldown, so the dispatcher stops picking it.
func TestNoteFailureParksRestrictedAccount(t *testing.T) {
	s := &Server{cooldowns: newCooldownTracker()}
	s.noteFailure(&core.ProviderError{Kind: core.ErrAccountRestricted, AccountID: "acc-1"})

	if !s.cooldowns.active("acc-1") {
		t.Fatal("a restricted account was not parked")
	}
	// The parking window must outlast the one a rejected credential gets.
	if got := s.cooldowns.remaining("acc-1"); got < cooldownAuth {
		t.Errorf("cooldown = %s, want at least %s", got, cooldownAuth)
	}
}

// TestNoteFailureLeavesHealthyAccountAlone pins that a transient upstream fault
// does not park the account: it is retried, and a second account should still
// be usable meanwhile.
func TestNoteFailureLeavesHealthyAccountAlone(t *testing.T) {
	s := &Server{cooldowns: newCooldownTracker()}
	s.noteFailure(&core.ProviderError{Kind: core.ErrUpstream, AccountID: "acc-1"})
	if s.cooldowns.active("acc-1") {
		t.Error("a transient upstream fault parked the account")
	}
	// A rate limit does park it, briefly.
	s.noteFailure(&core.ProviderError{Kind: core.ErrRateLimit, AccountID: "acc-1", RetryAfter: 2 * time.Second})
	if !s.cooldowns.active("acc-1") {
		t.Error("a rate limit did not park the account")
	}
}
