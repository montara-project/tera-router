package services

import (
	"bufio"
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"sync"
	"time"
)

// ErrCloudflaredMissing reports that the cloudflared binary is not on the
// server host's PATH.
var ErrCloudflaredMissing = errors.New("cloudflared is not installed on the server host")

// tunnelStartTimeout bounds how long Start waits for cloudflared to announce
// its public URL; registration normally takes a few seconds.
const tunnelStartTimeout = 30 * time.Second

// quickTunnelURL matches the public hostname cloudflared logs for a quick
// tunnel. Requiring a hyphenated label keeps api.trycloudflare.com — which
// shows up in cloudflared's own error lines — from being mistaken for one.
var quickTunnelURL = regexp.MustCompile(`https://[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com`)

// TunnelService runs a Cloudflare quick tunnel (`cloudflared tunnel --url`)
// as a child process exposing this server on a *.trycloudflare.com URL. The
// tunnel lives in memory only: it ends with the server and gets a new URL on
// every start.
type TunnelService struct {
	mu  sync.Mutex
	cmd *exec.Cmd
	url string
}

// TunnelStatus is what the dashboard shows for the Cloudflare tunnel.
type TunnelStatus struct {
	Installed bool   `json:"installed"`
	Running   bool   `json:"running"`
	URL       string `json:"url"`
}

// Status reports whether cloudflared is installed and the tunnel's public URL
// when one is up.
func (s *TunnelService) Status() TunnelStatus {
	_, err := exec.LookPath("cloudflared")

	s.mu.Lock()
	defer s.mu.Unlock()
	return TunnelStatus{Installed: err == nil, Running: s.url != "", URL: s.url}
}

// Start launches a quick tunnel to the local port and waits for its public
// URL. Starting while a tunnel is already up (or coming up) is a no-op.
func (s *TunnelService) Start(port int) (TunnelStatus, error) {
	bin, err := exec.LookPath("cloudflared")
	if err != nil {
		return TunnelStatus{}, ErrCloudflaredMissing
	}

	s.mu.Lock()
	if s.cmd != nil {
		s.mu.Unlock()
		return s.Status(), nil
	}
	cmd := exec.Command(bin, "tunnel", "--no-autoupdate", "--url", fmt.Sprintf("http://localhost:%d", port))
	stderr, err := cmd.StderrPipe()
	if err == nil {
		err = cmd.Start()
	}
	if err != nil {
		s.mu.Unlock()
		return TunnelStatus{}, fmt.Errorf("start cloudflared: %w", err)
	}
	s.cmd = cmd
	s.mu.Unlock()

	found := make(chan string, 1)
	exited := make(chan string, 1)
	go func() {
		// The pipe must be drained for the whole life of the process, or
		// cloudflared blocks once its log output fills the buffer.
		last := ""
		sc := bufio.NewScanner(stderr)
		for sc.Scan() {
			last = sc.Text()
			if u := quickTunnelURL.FindString(last); u != "" {
				select {
				case found <- u:
				default:
				}
			}
		}
		_ = cmd.Wait()

		s.mu.Lock()
		if s.cmd == cmd {
			s.cmd, s.url = nil, ""
		}
		s.mu.Unlock()
		exited <- last
	}()

	select {
	case u := <-found:
		s.mu.Lock()
		if s.cmd == cmd {
			s.url = u
		}
		s.mu.Unlock()
		return s.Status(), nil
	case last := <-exited:
		return TunnelStatus{}, fmt.Errorf("cloudflared exited before the tunnel came up: %s", last)
	case <-time.After(tunnelStartTimeout):
		s.Stop()
		return TunnelStatus{}, errors.New("timed out waiting for cloudflared to open the tunnel")
	}
}

// Stop tears the tunnel down; a no-op when none is running.
func (s *TunnelService) Stop() {
	s.mu.Lock()
	cmd := s.cmd
	s.cmd, s.url = nil, ""
	s.mu.Unlock()

	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
}
