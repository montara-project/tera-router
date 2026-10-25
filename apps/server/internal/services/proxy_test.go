package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"tera-router/server/internal/connectors"
)

// TestTestProxyRelayRejectsRelayErrors pins that a relay answering with a 4xx
// (wrong secret, bad target) is not reported healthy.
func TestTestProxyRelayRejectsRelayErrors(t *testing.T) {
	for _, tc := range []struct {
		status int
		want   bool
	}{{http.StatusNoContent, true}, {http.StatusForbidden, false}} {
		relay := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
		}))
		poolURL, err := connectors.RelayURL(relay.URL, "s")
		if err != nil {
			t.Fatal(err)
		}
		got, err := (&UpstreamService{}).TestProxy(context.Background(), poolURL)
		relay.Close()
		if err != nil || got != tc.want {
			t.Errorf("relay status %d: healthy = %v (err %v), want %v", tc.status, got, err, tc.want)
		}
	}
}
