package services

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("CLAUDE_CONFIG_DIR", "")
	t.Setenv("CODEX_HOME", "")
	return home
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(raw)
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

var testCfg = CLIToolConfig{BaseURL: "https://gw.example", APIKey: "sk_tr_secret", Model: "openai/gpt-x"}

// Every tool on the page has a spec, every spec previews with placeholders,
// and applying writes files that hold the real key and the /v1 base URL
// (Claude Code takes the bare base, since it appends its own paths).
func TestEveryCLIToolPreviewsAndApplies(t *testing.T) {
	for _, p := range cliToolProbes {
		t.Run(p.id, func(t *testing.T) {
			setHome(t)
			plan, err := PreviewCLITool(p.id, CLIToolConfig{BaseURL: "https://gw.example"})
			if err != nil || len(plan.Files) == 0 {
				t.Fatalf("preview = %+v, err %v", plan, err)
			}
			preview := ""
			for _, f := range plan.Files {
				if !strings.HasPrefix(f.DisplayPath, "~/") && p.id != "github-copilot" {
					t.Errorf("display path %q does not start with ~/", f.DisplayPath)
				}
				preview += f.Content
			}
			if !strings.Contains(preview, CLIToolKeyPlaceholder) {
				t.Errorf("preview has no key placeholder:\n%s", preview)
			}
			if plan.ModelRequired && !strings.Contains(preview, CLIToolModelPlaceholder) {
				t.Errorf("preview has no model placeholder:\n%s", preview)
			}

			written, err := ApplyCLITool(p.id, testCfg, nil)
			if err != nil || len(written) != len(plan.Files) {
				t.Fatalf("apply = %v, err %v", written, err)
			}
			all := ""
			for _, path := range written {
				all += readFile(t, path)
				if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
					t.Errorf("%s mode = %o, want 600", path, info.Mode().Perm())
				}
			}
			wantBase := "https://gw.example/v1"
			if p.id == "claude-code" {
				wantBase = `"https://gw.example"`
			}
			if !strings.Contains(all, "sk_tr_secret") || !strings.Contains(all, wantBase) {
				t.Errorf("written files miss the key or %s:\n%s", wantBase, all)
			}
		})
	}
}

// A required model is refused before anything is written.
func TestApplyCLIToolNeedsModel(t *testing.T) {
	home := setHome(t)
	_, err := ApplyCLITool("opencode", CLIToolConfig{BaseURL: "https://gw.example", APIKey: "k"}, nil)
	if err == nil {
		t.Fatal("want an error without a model")
	}
	if _, statErr := os.Stat(filepath.Join(home, ".config", "opencode")); !errors.Is(statErr, os.ErrNotExist) {
		t.Fatal("opencode folder was created")
	}
}

// JSON merges keep unrelated settings and replace our own entry on a second
// apply instead of adding another.
func TestApplyCLIToolMergesJSON(t *testing.T) {
	home := setHome(t)
	path := filepath.Join(home, ".factory", "settings.json")
	writeFile(t, path, `{"theme":"dark","customModels":[{"id":"custom:Mine-0","model":"m"}],"big":12345678901234567890}`)

	for range 2 {
		if _, err := ApplyCLITool("factory-droid", testCfg, nil); err != nil {
			t.Fatal(err)
		}
	}
	var doc map[string]any
	dec := json.NewDecoder(strings.NewReader(readFile(t, path)))
	dec.UseNumber()
	if err := dec.Decode(&doc); err != nil {
		t.Fatal(err)
	}
	models := doc["customModels"].([]any)
	if doc["theme"] != "dark" || len(models) != 2 || doc["activeModel"] != "custom:Tera-Router-0" {
		t.Fatalf("doc = %v", doc)
	}
	if doc["big"].(json.Number).String() != "12345678901234567890" {
		t.Fatalf("large number changed: %v", doc["big"])
	}
	// Mode of an existing file is kept.
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o644 {
		t.Fatalf("mode = %o, want 644 kept", info.Mode().Perm())
	}
}

// TOML edits keep comments and other tables, replace our table and its
// sub-tables, and are stable when applied twice.
func TestApplyCLIToolMergesTOML(t *testing.T) {
	home := setHome(t)
	path := filepath.Join(home, ".jcode", "config.toml")
	writeFile(t, path, "# my settings\ntheme = \"dark\"\n\n[providers.other]\nbase_url = \"x\"\n\n[providers.tera-router]\nbase_url = \"old\"\n\n[[providers.tera-router.models]]\nid = \"old\"\n")

	if _, err := ApplyCLITool("jcode", testCfg, nil); err != nil {
		t.Fatal(err)
	}
	first := readFile(t, path)
	if _, err := ApplyCLITool("jcode", testCfg, nil); err != nil {
		t.Fatal(err)
	}
	got := readFile(t, path)
	if got != first {
		t.Fatalf("second apply changed the file:\n%s\n---\n%s", first, got)
	}
	for _, want := range []string{"# my settings", `theme = "dark"`, "[providers.other]", `default_model = "openai/gpt-x"`, "[[providers.tera-router.models]]"} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in:\n%s", want, got)
		}
	}
	if strings.Contains(got, `"old"`) || strings.Count(got, "[providers.tera-router]") != 1 {
		t.Errorf("old table not replaced:\n%s", got)
	}
	if env := readFile(t, filepath.Join(home, ".config", "jcode", jcodeEnvFile)); env != jcodeKeyEnv+"=sk_tr_secret\n" {
		t.Errorf("env file = %q", env)
	}
}

// Codex: top-level keys go before the first table, and an empty model
// removes the key so Codex falls back to its own default.
func TestApplyCLIToolCodexTopLevel(t *testing.T) {
	home := setHome(t)
	path := filepath.Join(home, ".codex", "config.toml")
	writeFile(t, path, "model = \"o3\"\n\n[profiles.fast]\nmodel = \"keep\"\n")

	if _, err := ApplyCLITool("codex-cli", CLIToolConfig{BaseURL: "https://gw.example", APIKey: "k"}, nil); err != nil {
		t.Fatal(err)
	}
	got := readFile(t, path)
	want := "model_provider = \"tera-router\"\n\n[profiles.fast]\nmodel = \"keep\"\n\n[model_providers.tera-router]\n"
	if !strings.HasPrefix(got, want) {
		t.Fatalf("got:\n%s\nwant prefix:\n%s", got, want)
	}
}

// YAML: only the top-level model block is replaced.
func TestApplyCLIToolMergesYAML(t *testing.T) {
	home := setHome(t)
	path := filepath.Join(home, ".hermes", "config.yaml")
	writeFile(t, path, "model:\n  default: old\n  provider: openrouter\n\nterminal:\n  backend: local\n")
	writeFile(t, filepath.Join(home, ".hermes", ".env"), "OTHER=1\nexport OPENAI_API_KEY=old\n")

	if _, err := ApplyCLITool("hermes-agent", testCfg, nil); err != nil {
		t.Fatal(err)
	}
	got := readFile(t, path)
	want := "model:\n  default: \"openai/gpt-x\"\n  provider: \"custom\"\n  base_url: \"https://gw.example/v1\"\n\nterminal:\n  backend: local\n"
	if got != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}
	if env := readFile(t, filepath.Join(home, ".hermes", ".env")); env != "OTHER=1\nOPENAI_API_KEY=sk_tr_secret\n" {
		t.Fatalf("env = %q", env)
	}
}

// A file that cannot be parsed stops the apply before any file or key is
// written, and the other files of the same tool stay untouched.
func TestApplyCLIToolRefusesUnparseableFile(t *testing.T) {
	home := setHome(t)
	state := filepath.Join(home, ".cline", "data", "globalState.json")
	secrets := filepath.Join(home, ".cline", "data", "secrets.json")
	writeFile(t, state, `{"keep":true}`)
	writeFile(t, secrets, `// not json`)

	called := false
	_, err := ApplyCLITool("cline-roo", testCfg, func() error { called = true; return nil })
	if err == nil || !strings.Contains(err.Error(), "is not a JSON object") {
		t.Fatalf("err = %v", err)
	}
	if called || readFile(t, state) != `{"keep":true}` {
		t.Fatal("apply wrote or stored something despite the bad file")
	}
}
