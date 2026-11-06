package gateway

import (
	"testing"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"
)

// TestApplyPool pins how a bound pool shapes an account's connection.
func TestApplyPool(t *testing.T) {
	up := models.ProxyPool{Name: "p", URL: "http://proxy:1", Status: proxyPoolActive, Bypass: "localhost"}
	down := models.ProxyPool{Name: "p", URL: "http://proxy:1", Status: "inactive"}

	cases := []struct {
		name      string
		pool      models.ProxyPool
		wantProxy string
		wantErr   bool
	}{
		{"reachable", up, "http://proxy:1", false},
		{"disabled", func() models.ProxyPool { p := up; p.Disabled = true; return p }(), "", false},
		{"unreachable", down, "", false},
		{"unreachable strict", func() models.ProxyPool { p := down; p.Strict = true; return p }(), "", true},
		{"disabled strict", func() models.ProxyPool { p := down; p.Strict, p.Disabled = true, true; return p }(), "", false},
	}
	for _, tc := range cases {
		var creds core.Credentials
		err := applyPool(&creds, tc.pool)
		if (err != nil) != tc.wantErr || creds.ProxyURL != tc.wantProxy {
			t.Errorf("%s: proxy = %q, err = %v", tc.name, creds.ProxyURL, err)
		}
	}
	var creds core.Credentials
	_ = applyPool(&creds, up)
	if creds.ProxyBypass != "localhost" {
		t.Errorf("bypass = %q, want localhost", creds.ProxyBypass)
	}
}
