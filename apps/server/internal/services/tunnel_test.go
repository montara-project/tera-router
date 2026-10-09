package services

import "testing"

func TestQuickTunnelURL(t *testing.T) {
	cases := map[string]string{
		"2025-01-01T00:00:00Z INF |  https://sunny-blue-fox-lamp.trycloudflare.com  |":         "https://sunny-blue-fox-lamp.trycloudflare.com",
		`ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": EOF`: "",
		"INF Requesting new quick Tunnel on trycloudflare.com...":                              "",
	}
	for line, want := range cases {
		if got := quickTunnelURL.FindString(line); got != want {
			t.Errorf("FindString(%q) = %q, want %q", line, got, want)
		}
	}
}
