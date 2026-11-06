package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectCLITools(t *testing.T) {
	home := t.TempDir()
	ext := filepath.Join(home, ".cursor", "extensions", "kilocode.kilo-code-4.2.0")
	if err := os.MkdirAll(ext, 0o755); err != nil {
		t.Fatal(err)
	}

	found := map[string]string{"codex": "/bin/codex", "deepseek": "/bin/deepseek"}
	got := map[string]CLIToolStatus{}
	for _, st := range detectCLITools(home, func(name string) string { return found[name] }) {
		got[st.ID] = st
	}

	if len(got) != len(cliToolProbes) {
		t.Fatalf("got %d tools, want %d", len(got), len(cliToolProbes))
	}
	if st := got["codex-cli"]; !st.Installed || st.Path != "/bin/codex" {
		t.Errorf("codex-cli = %+v, want installed at /bin/codex", st)
	}
	// The second binary name is a fallback.
	if st := got["deepseek-tui"]; !st.Installed || st.Path != "/bin/deepseek" {
		t.Errorf("deepseek-tui = %+v, want installed at /bin/deepseek", st)
	}
	if st := got["kilo-code"]; !st.Installed || st.Path != ext {
		t.Errorf("kilo-code = %+v, want the Cursor extension folder", st)
	}
	if st := got["claude-code"]; st.Installed {
		t.Errorf("claude-code = %+v, want not installed", st)
	}
	if st := got["github-copilot"]; st.Installed {
		t.Errorf("github-copilot = %+v, want not installed", st)
	}
}

func TestFindBinaryChecksUserBinFolders(t *testing.T) {
	home := t.TempDir()
	bin := filepath.Join(home, ".bun", "bin", "tera-test-tool")
	if err := os.MkdirAll(filepath.Dir(bin), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(bin, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if got := findBinary(home, "tera-test-tool"); got != bin {
		t.Errorf("findBinary = %q, want %q", got, bin)
	}
	if got := findBinary(home, "tera-missing-tool"); got != "" {
		t.Errorf("findBinary(missing) = %q, want empty", got)
	}
}
