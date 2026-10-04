package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Environment variables Claude Code reads from the `env` block of its
// settings file to reach an Anthropic-compatible gateway.
const (
	ClaudeEnvBaseURL   = "ANTHROPIC_BASE_URL"
	ClaudeEnvAuthToken = "ANTHROPIC_AUTH_TOKEN"
	ClaudeEnvModel     = "ANTHROPIC_MODEL"
)

// claudeVersionTimeout bounds `claude --version`; the CLI is a Node program
// whose cold start can take a moment, but a hung binary must not stall the
// dashboard request.
const claudeVersionTimeout = 5 * time.Second

// ClaudeCodeService probes this host for the Claude Code CLI and manages its
// user settings file (~/.claude/settings.json), whose `env` block points the
// CLI at this router.
type ClaudeCodeService struct{}

// ClaudeCodeStatus is what the dashboard shows for the CLI on this host.
type ClaudeCodeStatus struct {
	Installed  bool   `json:"installed"`
	Version    string `json:"version"`
	BinaryPath string `json:"binary_path"`
	ConfigPath string `json:"config_path"`
	// ConfigExists reports whether the settings file is present; ConfigError
	// carries the parse failure when it is present but not a JSON object.
	ConfigExists bool   `json:"config_exists"`
	ConfigError  string `json:"config_error"`
	BaseURL      string `json:"base_url"`
	Model        string `json:"model"`
	// AuthToken is the configured gateway credential. It stays server-side:
	// handlers use it only to resolve which API key is wired in.
	AuthToken string `json:"-"`
}

// ClaudeCodeConfig is the gateway wiring written into the settings file. An
// empty Model removes ANTHROPIC_MODEL so the CLI falls back to its default.
type ClaudeCodeConfig struct {
	BaseURL   string
	AuthToken string
	Model     string
}

// Status reports whether the CLI is installed and what the settings file
// currently configures. A malformed settings file is reported, not fatal.
func (s *ClaudeCodeService) Status(ctx context.Context) (ClaudeCodeStatus, error) {
	path, err := claudeSettingsPath()
	if err != nil {
		return ClaudeCodeStatus{}, err
	}

	st := ClaudeCodeStatus{ConfigPath: path}
	if bin := findClaudeBinary(); bin != "" {
		st.Installed = true
		st.BinaryPath = bin
		st.Version = claudeVersion(ctx, bin)
	}

	settings, exists, err := readClaudeSettings(path)
	st.ConfigExists = exists
	if err != nil {
		st.ConfigError = err.Error()
		return st, nil
	}
	if env, ok := settings["env"].(map[string]any); ok {
		st.BaseURL, _ = env[ClaudeEnvBaseURL].(string)
		st.AuthToken, _ = env[ClaudeEnvAuthToken].(string)
		st.Model, _ = env[ClaudeEnvModel].(string)
	}
	return st, nil
}

// Apply merges cfg into the settings file, keeping every unrelated key.
func (s *ClaudeCodeService) Apply(cfg ClaudeCodeConfig) error {
	path, err := claudeSettingsPath()
	if err != nil {
		return err
	}
	return writeClaudeSettings(path, cfg)
}

// claudeSettingsPath honors CLAUDE_CONFIG_DIR, which Claude Code itself uses
// to relocate ~/.claude.
func claudeSettingsPath() (string, error) {
	if dir := os.Getenv("CLAUDE_CONFIG_DIR"); dir != "" {
		return filepath.Join(dir, "settings.json"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home directory: %w", err)
	}
	return filepath.Join(home, ".claude", "settings.json"), nil
}

// findClaudeBinary looks on PATH first, then in the locations the native and
// npm installers use, since a service's PATH rarely includes user bin dirs.
func findClaudeBinary() string {
	if bin, err := exec.LookPath("claude"); err == nil {
		return bin
	}
	candidates := []string{"/usr/local/bin/claude", "/opt/homebrew/bin/claude"}
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append([]string{
			filepath.Join(home, ".local", "bin", "claude"),
			filepath.Join(home, ".claude", "local", "claude"),
			filepath.Join(home, ".npm-global", "bin", "claude"),
		}, candidates...)
	}
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.Mode().IsRegular() && info.Mode().Perm()&0o111 != 0 {
			return c
		}
	}
	return ""
}

// claudeVersion returns the first line of `claude --version`, or "" when the
// binary fails or times out.
func claudeVersion(ctx context.Context, bin string) string {
	ctx, cancel := context.WithTimeout(ctx, claudeVersionTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, bin, "--version").Output()
	if err != nil {
		return ""
	}
	line, _, _ := strings.Cut(strings.TrimSpace(string(out)), "\n")
	return strings.TrimSpace(line)
}

// readClaudeSettings parses the settings file. A missing or empty file is an
// empty document; anything that is not a JSON object is an error so callers
// never overwrite a file they could not understand.
func readClaudeSettings(path string) (map[string]any, bool, error) {
	raw, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return map[string]any{}, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("read %s: %w", path, err)
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return map[string]any{}, true, nil
	}
	var settings map[string]any
	if err := json.Unmarshal(raw, &settings); err != nil || settings == nil {
		return nil, true, fmt.Errorf("%s is not a JSON object", path)
	}
	return settings, true, nil
}

// writeClaudeSettings merges cfg into the `env` block and atomically replaces
// the file, creating it (0600, directory 0700) when absent.
func writeClaudeSettings(path string, cfg ClaudeCodeConfig) error {
	settings, exists, err := readClaudeSettings(path)
	if err != nil {
		return err
	}

	env := map[string]any{}
	if current, ok := settings["env"]; ok {
		obj, isObj := current.(map[string]any)
		if !isObj {
			return fmt.Errorf("%s: \"env\" is not an object", path)
		}
		env = obj
	}
	env[ClaudeEnvBaseURL] = cfg.BaseURL
	env[ClaudeEnvAuthToken] = cfg.AuthToken
	if cfg.Model != "" {
		env[ClaudeEnvModel] = cfg.Model
	} else {
		delete(env, ClaudeEnvModel)
	}
	settings["env"] = env
	settings["hasCompletedOnboarding"] = true

	raw, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')

	mode := fs.FileMode(0o600)
	if exists {
		if info, err := os.Stat(path); err == nil {
			mode = info.Mode().Perm()
		}
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create %s: %w", dir, err)
	}
	tmp, err := os.CreateTemp(dir, ".settings-*.json")
	if err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	defer os.Remove(tmp.Name())

	if _, err := tmp.Write(raw); err != nil {
		tmp.Close()
		return fmt.Errorf("write %s: %w", path, err)
	}
	if err := tmp.Chmod(mode); err != nil {
		tmp.Close()
		return fmt.Errorf("write %s: %w", path, err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	if err := os.Rename(tmp.Name(), path); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}
