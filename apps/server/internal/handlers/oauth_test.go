package handlers

import "testing"

// The completion signal hinges on classifying the dashboard origin: loopback
// hosts can receive the fixed-loopback redirect directly, any other origin
// must collect the callback URL the popup ends on.
func TestIsLoopbackHost(t *testing.T) {
	for _, host := range []string{"localhost", "127.0.0.1", "::1", "sub.localhost"} {
		if !isLoopbackHost(host) {
			t.Errorf("isLoopbackHost(%q) = false, want true", host)
		}
	}
	for _, host := range []string{"llm.terarouter.xyz", "192.168.1.10", "example.com", "[::1]", ""} {
		if isLoopbackHost(host) {
			t.Errorf("isLoopbackHost(%q) = true, want false", host)
		}
	}
}
