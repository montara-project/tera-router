package connectors

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/core"
)

// TestRelayTransportForwardsTargetAndSecret pins the relay wire contract the
// generated worker.js / relay.mjs scripts rely on.
func TestRelayTransportForwardsTargetAndSecret(t *testing.T) {
	var gotTarget, gotSecret, gotBody, gotPath string
	relay := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTarget = r.Header.Get(RelayTargetHeader)
		gotSecret = r.Header.Get(RelaySecretHeader)
		gotPath = r.URL.Path
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.WriteHeader(http.StatusTeapot)
	}))
	defer relay.Close()

	poolURL, err := RelayURL(relay.URL+"/r", "s3cret")
	if err != nil {
		t.Fatal(err)
	}
	if !IsRelayURL(poolURL) || !strings.HasPrefix(poolURL, "relay+http://:s3cret@") {
		t.Fatalf("pool URL = %q", poolURL)
	}

	resp, err := clientFor(core.Credentials{ProxyURL: poolURL}).Post("https://api.example.com/v1/chat?x=1", "application/json", strings.NewReader(`{"a":1}`))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusTeapot {
		t.Errorf("status = %d, want the relay's 418", resp.StatusCode)
	}
	if gotTarget != "https://api.example.com/v1/chat?x=1" || gotSecret != "s3cret" || gotPath != "/r" || gotBody != `{"a":1}` {
		t.Errorf("relay saw target=%q secret=%q path=%q body=%q", gotTarget, gotSecret, gotPath, gotBody)
	}

	if _, err := NewRelayTransport("relay+ftp://:x@host", http.DefaultTransport); err == nil {
		t.Error("non-http relay scheme accepted")
	}
}
