package handlers

import (
	"strings"
	"testing"
)

func TestLoopbackOrigin(t *testing.T) {
	cases := map[string]string{
		"http://localhost:5173":    "http://localhost:5173",
		"http://127.0.0.1:8080":    "http://127.0.0.1:8080",
		"http://[::1]:8080":        "http://[::1]:8080",
		"https://app.localhost":    "https://app.localhost",
		"https://router.example":   "",
		"http://localhost.evil.io": "",
		"javascript://localhost":   "",
		"":                         "",
		"null":                     "",
	}
	for in, want := range cases {
		if got := loopbackOrigin(in); got != want {
			t.Errorf("loopbackOrigin(%q) = %q, want %q", in, got, want)
		}
	}
}

// The callback page reports only to the dashboard that started the flow, and
// to nobody when that is unknown.
func TestOAuthPopupResultTargetsTheDashboardOrigin(t *testing.T) {
	page := renderOAuthPopupResult("success", "", "http://localhost:5173")
	if !strings.Contains(page, `, "http://localhost:5173");`) || strings.Contains(page, `"*"`) {
		t.Errorf("postMessage is not pinned to the dashboard origin:\n%s", page)
	}

	failed := renderOAuthPopupResult("error", "session expired", "")
	if strings.Contains(failed, "postMessage") || strings.Contains(failed, "window.close") {
		t.Errorf("a failure with no dashboard to tell must stay on screen:\n%s", failed)
	}
}
