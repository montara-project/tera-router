package services

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func readJSON(t *testing.T, path string) map[string]any {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read settings: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("parse settings: %v", err)
	}
	return out
}

func TestWriteClaudeSettingsCreatesPrivateFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".claude", "settings.json")

	err := writeClaudeSettings(path, ClaudeCodeConfig{BaseURL: "http://r.local", AuthToken: "sk_tr_abc"})
	if err != nil {
		t.Fatalf("write: %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Errorf("mode = %o, want 600 (file holds a credential)", perm)
	}
	env := readJSON(t, path)["env"].(map[string]any)
	if env[ClaudeEnvBaseURL] != "http://r.local" || env[ClaudeEnvAuthToken] != "sk_tr_abc" {
		t.Errorf("env = %v", env)
	}
	if _, ok := env[ClaudeEnvModel]; ok {
		t.Errorf("empty model wrote %s", ClaudeEnvModel)
	}
}

func TestWriteClaudeSettingsPreservesUnrelatedKeys(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	existing := `{"permissions":{"allow":["Bash(ls)"]},"env":{"DISABLE_TELEMETRY":"1","ANTHROPIC_MODEL":"old/model"}}`
	if err := os.WriteFile(path, []byte(existing), 0o644); err != nil {
		t.Fatal(err)
	}

	err := writeClaudeSettings(path, ClaudeCodeConfig{BaseURL: "https://r", AuthToken: "t", Model: ""})
	if err != nil {
		t.Fatalf("write: %v", err)
	}

	got := readJSON(t, path)
	if _, ok := got["permissions"]; !ok {
		t.Error("permissions block dropped")
	}
	env := got["env"].(map[string]any)
	if env["DISABLE_TELEMETRY"] != "1" {
		t.Errorf("unrelated env var dropped: %v", env)
	}
	if _, ok := env[ClaudeEnvModel]; ok {
		t.Error("clearing the model must remove the stale ANTHROPIC_MODEL")
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o644 {
		t.Errorf("existing mode not preserved: %o", info.Mode().Perm())
	}
}

func TestWriteClaudeSettingsRefusesUnparseableFile(t *testing.T) {
	for name, content := range map[string]string{
		"invalid json": `{"env": `,
		"array":        `[]`,
		"env scalar":   `{"env": "x"}`,
	} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "settings.json")
			if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
				t.Fatal(err)
			}
			if err := writeClaudeSettings(path, ClaudeCodeConfig{BaseURL: "https://r", AuthToken: "t"}); err == nil {
				t.Fatal("write succeeded; it must not clobber a file it cannot parse")
			}
			if raw, _ := os.ReadFile(path); string(raw) != content {
				t.Errorf("file changed to %q", raw)
			}
		})
	}
}

func TestStatusReadsConfiguredEnv(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("CLAUDE_CONFIG_DIR", dir)

	svc := &ClaudeCodeService{}
	if err := svc.Apply(ClaudeCodeConfig{BaseURL: "https://r", AuthToken: "tok", Model: "chain:fast"}); err != nil {
		t.Fatalf("apply: %v", err)
	}

	st, err := svc.Status(context.Background())
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if st.ConfigPath != filepath.Join(dir, "settings.json") || !st.ConfigExists {
		t.Errorf("config path/exists = %q/%v", st.ConfigPath, st.ConfigExists)
	}
	if st.BaseURL != "https://r" || st.AuthToken != "tok" || st.Model != "chain:fast" {
		t.Errorf("status = %+v", st)
	}

	if err := os.WriteFile(st.ConfigPath, []byte("nope"), 0o600); err != nil {
		t.Fatal(err)
	}
	st, err = svc.Status(context.Background())
	if err != nil || st.ConfigError == "" {
		t.Errorf("malformed file: err=%v config_error=%q, want reported not fatal", err, st.ConfigError)
	}
}
