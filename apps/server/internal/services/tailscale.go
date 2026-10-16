package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// ErrTailscaleMissing reports that the tailscale CLI is not on the server
// host's PATH.
var ErrTailscaleMissing = errors.New("tailscale is not installed on the server host")

// tailscaleTimeout bounds one tailscale CLI call. serve may provision the
// node's HTTPS certificate on first use, which takes a few seconds.
const tailscaleTimeout = 30 * time.Second

// TailscaleService exposes this server to the host's tailnet over HTTPS with
// `tailscale serve`. It holds no state: tailscaled stores the serve config
// (--bg) and keeps it across restarts of this server and of the host, so the
// CLI is the source of truth.
type TailscaleService struct{}

// TailscaleStatus is what the dashboard shows for Tailscale.
type TailscaleStatus struct {
	Installed bool `json:"installed"`
	// LoggedIn is false until the host has joined a tailnet (`tailscale up`).
	LoggedIn bool   `json:"logged_in"`
	Running  bool   `json:"running"`
	URL      string `json:"url"`
}

// Status reports whether tailscale is installed and logged in, and whether
// it serves this server's port at https://<machine>.<tailnet>.ts.net.
func (s *TailscaleService) Status(port int) TailscaleStatus {
	if _, err := exec.LookPath("tailscale"); err != nil {
		return TailscaleStatus{}
	}
	st := TailscaleStatus{Installed: true}

	var node struct {
		BackendState string
		Self         struct{ DNSName string }
	}
	if out, err := tailscale("status", "--json"); err != nil || json.Unmarshal(out, &node) != nil {
		return st
	}
	host := strings.TrimSuffix(node.Self.DNSName, ".")
	st.LoggedIn = node.BackendState == "Running" && host != ""
	if !st.LoggedIn {
		return st
	}

	var serve struct {
		Web map[string]struct {
			Handlers map[string]struct{ Proxy string }
		}
	}
	if out, err := tailscale("serve", "status", "--json"); err == nil && json.Unmarshal(out, &serve) == nil {
		if serve.Web[host+":443"].Handlers["/"].Proxy == proxyTarget(port) {
			st.Running, st.URL = true, "https://"+host
		}
	}
	return st
}

// Start serves the local port on the tailnet at https://<machine>.ts.net.
func (s *TailscaleService) Start(port int) (TailscaleStatus, error) {
	st := s.Status(port)
	switch {
	case !st.Installed:
		return st, ErrTailscaleMissing
	case !st.LoggedIn:
		return st, errors.New("tailscale is not connected to a tailnet; run `tailscale up` on the server host")
	case st.Running:
		return st, nil
	}
	if out, err := tailscale("serve", "--bg", "--https=443", proxyTarget(port)); err != nil {
		return st, fmt.Errorf("tailscale serve failed: %s", cliError(out, err))
	}
	return s.Status(port), nil
}

// Stop removes this server's serve mapping, leaving any other serve config on
// the host untouched; a no-op when it is not served.
func (s *TailscaleService) Stop(port int) (TailscaleStatus, error) {
	if st := s.Status(port); !st.Running {
		return st, nil
	}
	if out, err := tailscale("serve", "--https=443", proxyTarget(port), "off"); err != nil {
		return s.Status(port), fmt.Errorf("tailscale serve off failed: %s", cliError(out, err))
	}
	return s.Status(port), nil
}

// proxyTarget is the backend tailscale serve forwards to, written the way
// `tailscale serve status --json` reports it back.
func proxyTarget(port int) string {
	return fmt.Sprintf("http://127.0.0.1:%d", port)
}

// tailscale runs one tailscale CLI command and returns its combined output.
func tailscale(args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), tailscaleTimeout)
	defer cancel()
	return exec.CommandContext(ctx, "tailscale", args...).CombinedOutput()
}

// cliError prefers the CLI's own message (e.g. "HTTPS is not enabled for this
// tailnet", "access denied: use sudo or --operator") over the exit status.
func cliError(out []byte, err error) string {
	if msg := strings.TrimSpace(string(out)); msg != "" {
		return msg
	}
	return err.Error()
}
