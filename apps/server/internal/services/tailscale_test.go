package services

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakeTailscale puts a tailscale script on PATH that answers status from
// state files and records serve on/off, mimicking the real CLI's JSON.
func fakeTailscale(t *testing.T, loggedIn bool) string {
	t.Helper()
	dir := t.TempDir()
	state := "Running"
	if !loggedIn {
		state = "NeedsLogin"
	}
	script := `#!/bin/sh
d="` + dir + `"
echo "$*" >> "$d/calls"
case "$*" in
  "status --json") echo '{"BackendState":"` + state + `","Self":{"DNSName":"box.tail1234.ts.net."}}' ;;
  "serve status --json")
    if [ -f "$d/served" ]; then echo '{"Web":{"box.tail1234.ts.net:443":{"Handlers":{"/":{"Proxy":"'"$(cat "$d/served")"'"}}}}}'; else echo '{}'; fi ;;
  "serve --bg --https=443 "*) echo "$4" > "$d/served" ;;
  *" off") rm -f "$d/served" ;;
  *) echo "unexpected: $*" >&2; exit 1 ;;
esac
`
	if err := os.WriteFile(filepath.Join(dir, "tailscale"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	return dir
}

func TestTailscaleServeLifecycle(t *testing.T) {
	dir := fakeTailscale(t, true)
	s := &TailscaleService{}

	if st := s.Status(8080); !st.Installed || !st.LoggedIn || st.Running {
		t.Fatalf("initial status = %+v", st)
	}
	st, err := s.Start(8080)
	if err != nil || !st.Running || st.URL != "https://box.tail1234.ts.net" {
		t.Fatalf("start = %+v, %v", st, err)
	}
	// Another port's server is not this one.
	if other := s.Status(9090); other.Running {
		t.Errorf("status for another port = %+v, want not running", other)
	}
	if st, err = s.Stop(8080); err != nil || st.Running {
		t.Fatalf("stop = %+v, %v", st, err)
	}
	calls, _ := os.ReadFile(filepath.Join(dir, "calls"))
	for _, want := range []string{"serve --bg --https=443 http://127.0.0.1:8080", "serve --https=443 http://127.0.0.1:8080 off"} {
		if !strings.Contains(string(calls), want) {
			t.Errorf("CLI never ran %q; calls:\n%s", want, calls)
		}
	}
}

func TestTailscaleStartNeedsLogin(t *testing.T) {
	fakeTailscale(t, false)
	if _, err := (&TailscaleService{}).Start(8080); err == nil || !strings.Contains(err.Error(), "tailscale up") {
		t.Fatalf("start while logged out: err = %v", err)
	}
}

func TestTailscaleMissing(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	s := &TailscaleService{}
	if st := s.Status(8080); st.Installed {
		t.Fatalf("status = %+v, want not installed", st)
	}
	if _, err := s.Start(8080); err != ErrTailscaleMissing {
		t.Fatalf("start err = %v, want ErrTailscaleMissing", err)
	}
}
