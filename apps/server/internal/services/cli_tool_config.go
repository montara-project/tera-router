package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

// Values the config preview shows in place of a real key or model.
const (
	CLIToolKeyPlaceholder   = "sk_tr_YOUR_API_KEY"
	CLIToolModelPlaceholder = "provider/model-id"
)

// Names the gateway is registered under inside each tool's config.
const (
	cliProviderID   = "tera-router"
	cliProviderName = "Tera Router"
)

// ErrUnknownCLITool is returned for an id with no config spec.
var ErrUnknownCLITool = errors.New("unknown CLI tool")

// CLIToolConfig is what a coding tool is pointed at. BaseURL is the gateway
// root without /v1. An empty Model leaves the tool on its own default, which
// only tools whose spec allows it accept.
type CLIToolConfig struct {
	BaseURL string
	APIKey  string
	Model   string
}

// CLIToolFile is one config file of a tool, with the content the gateway
// part of it takes.
type CLIToolFile struct {
	// Path is the absolute path on this host.
	Path string `json:"path"`
	// DisplayPath is Path with the home folder shortened to ~.
	DisplayPath string `json:"display_path"`
	Label       string `json:"label"`
	// Partial is true when the tool keeps other settings in the same file, so
	// the content is merged into it rather than replacing it.
	Partial bool   `json:"partial"`
	Content string `json:"content"`
}

// CLIToolEnvVar is one environment variable a tool reads from its config.
type CLIToolEnvVar struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	File  string `json:"file"`
}

// CLIToolPlan is what configuring one tool writes.
type CLIToolPlan struct {
	ModelRequired bool            `json:"model_required"`
	Files         []CLIToolFile   `json:"files"`
	Env           []CLIToolEnvVar `json:"env"`
}

// cliToolFileSpec is one file of a tool: where it lives, and how the gateway
// settings merge into its current content (nil when the file is missing).
type cliToolFileSpec struct {
	path    func(home string) string
	label   string
	partial bool
	merge   func(current []byte, cfg CLIToolConfig) ([]byte, error)
	env     func(cfg CLIToolConfig) []CLIToolEnvVar
}

type cliToolSpec struct {
	modelRequired bool
	files         []cliToolFileSpec
}

func inHome(parts ...string) func(string) string {
	return func(home string) string { return filepath.Join(append([]string{home}, parts...)...) }
}

func v1(cfg CLIToolConfig) string { return cfg.BaseURL + "/v1" }

// cliToolSpecs holds every tool the dashboard can configure, keyed by the
// same ids as cliToolProbes.
var cliToolSpecs = map[string]cliToolSpec{
	"claude-code": {files: []cliToolFileSpec{{
		path: func(home string) string {
			// Claude Code relocates ~/.claude to CLAUDE_CONFIG_DIR.
			if dir := os.Getenv("CLAUDE_CONFIG_DIR"); dir != "" {
				return filepath.Join(dir, "settings.json")
			}
			return filepath.Join(home, ".claude", "settings.json")
		},
		label: "settings.json",
		merge: jsonMerge(func(doc map[string]any, cfg CLIToolConfig) error {
			env, err := objectAt(doc, "env")
			if err != nil {
				return err
			}
			env["ANTHROPIC_BASE_URL"] = cfg.BaseURL
			env["ANTHROPIC_AUTH_TOKEN"] = cfg.APIKey
			if cfg.Model != "" {
				env["ANTHROPIC_MODEL"] = cfg.Model
			} else {
				delete(env, "ANTHROPIC_MODEL")
			}
			doc["hasCompletedOnboarding"] = true
			return nil
		}),
		env: func(cfg CLIToolConfig) []CLIToolEnvVar {
			vars := []CLIToolEnvVar{
				{"ANTHROPIC_BASE_URL", cfg.BaseURL, "settings.json"},
				{"ANTHROPIC_AUTH_TOKEN", cfg.APIKey, "settings.json"},
			}
			if cfg.Model != "" {
				vars = append(vars, CLIToolEnvVar{"ANTHROPIC_MODEL", cfg.Model, "settings.json"})
			}
			return vars
		},
	}}},

	"cline-roo": {modelRequired: true, files: []cliToolFileSpec{
		{
			path:    inHome(".cline", "data", "globalState.json"),
			label:   "globalState.json",
			partial: true,
			merge: jsonMerge(func(doc map[string]any, cfg CLIToolConfig) error {
				doc["actModeApiProvider"] = "openai"
				doc["planModeApiProvider"] = "openai"
				doc["openAiBaseUrl"] = v1(cfg)
				doc["openAiModelId"] = cfg.Model
				doc["planModeOpenAiModelId"] = cfg.Model
				return nil
			}),
		},
		{
			path:  inHome(".cline", "data", "secrets.json"),
			label: "secrets.json",
			merge: jsonMerge(func(doc map[string]any, cfg CLIToolConfig) error {
				doc["openAiApiKey"] = cfg.APIKey
				return nil
			}),
		},
	}},

	"codex-cli": {files: []cliToolFileSpec{{
		path: func(home string) string {
			if dir := os.Getenv("CODEX_HOME"); dir != "" {
				return filepath.Join(dir, "config.toml")
			}
			return filepath.Join(home, ".codex", "config.toml")
		},
		label: "config.toml",
		merge: func(current []byte, cfg CLIToolConfig) ([]byte, error) {
			doc := tomlSetTop(string(current), "model_provider", quote(cliProviderID))
			doc = tomlSetTop(doc, "model", optionalQuote(cfg.Model))
			doc = tomlReplaceTable(doc, "model_providers."+cliProviderID, tomlTable("model_providers."+cliProviderID,
				"name", quote(cliProviderName),
				"base_url", quote(v1(cfg)),
				"wire_api", quote("responses"),
				"experimental_bearer_token", quote(cfg.APIKey),
			))
			return []byte(doc), nil
		},
	}}},

	"deepseek-tui": {modelRequired: true, files: []cliToolFileSpec{{
		path:  inHome(".deepseek", "config.toml"),
		label: "config.toml",
		merge: func(current []byte, cfg CLIToolConfig) ([]byte, error) {
			doc := tomlSetTop(string(current), "provider", quote("openai"))
			doc = tomlReplaceTable(doc, "providers.openai", tomlTable("providers.openai",
				"base_url", quote(v1(cfg)),
				"api_key", quote(cfg.APIKey),
				"model", quote(cfg.Model),
			))
			return []byte(doc), nil
		},
	}}},

	"factory-droid": {modelRequired: true, files: []cliToolFileSpec{{
		path:  inHome(".factory", "settings.json"),
		label: "settings.json",
		merge: jsonMerge(func(doc map[string]any, cfg CLIToolConfig) error {
			const id = "custom:Tera-Router-0"
			models, err := arrayAt(doc, "customModels")
			if err != nil {
				return err
			}
			doc["customModels"] = append(withoutEntry(models, "id", id), map[string]any{
				"model":           cfg.Model,
				"id":              id,
				"baseUrl":         v1(cfg),
				"apiKey":          cfg.APIKey,
				"displayName":     cfg.Model + " (" + cliProviderName + ")",
				"maxOutputTokens": 131072,
				"provider":        "openai",
			})
			doc["activeModel"] = id
			return nil
		}),
	}}},

	"github-copilot": {modelRequired: true, files: []cliToolFileSpec{{
		path:  vscodeUserFile("chatLanguageModels.json"),
		label: "chatLanguageModels.json",
		merge: func(current []byte, cfg CLIToolConfig) ([]byte, error) {
			var list []any
			if len(bytes.TrimSpace(current)) > 0 {
				if err := decodeJSON(current, &list); err != nil {
					return nil, errors.New("is not a JSON array")
				}
			}
			list = append(withoutEntry(list, "name", cliProviderName), map[string]any{
				"name":   cliProviderName,
				"vendor": "azure",
				"apiKey": cfg.APIKey,
				"models": []any{map[string]any{
					"id":              cfg.Model,
					"name":            cfg.Model,
					"url":             v1(cfg) + "/chat/completions#models.ai.azure.com",
					"toolCalling":     true,
					"vision":          false,
					"maxInputTokens":  128000,
					"maxOutputTokens": 16000,
				}},
			})
			return encodeJSON(list)
		},
	}}},

	"hermes-agent": {modelRequired: true, files: []cliToolFileSpec{
		{
			path:  inHome(".hermes", "config.yaml"),
			label: "config.yaml",
			merge: func(current []byte, cfg CLIToolConfig) ([]byte, error) {
				block := "model:\n" +
					"  default: " + quote(cfg.Model) + "\n" +
					"  provider: " + quote("custom") + "\n" +
					"  base_url: " + quote(v1(cfg)) + "\n"
				return []byte(yamlReplaceTop(string(current), "model", block)), nil
			},
		},
		{
			path:  inHome(".hermes", ".env"),
			label: ".env",
			merge: func(current []byte, cfg CLIToolConfig) ([]byte, error) {
				return []byte(envSet(string(current), "OPENAI_API_KEY", cfg.APIKey)), nil
			},
			env: func(cfg CLIToolConfig) []CLIToolEnvVar {
				return []CLIToolEnvVar{{"OPENAI_API_KEY", cfg.APIKey, ".env"}}
			},
		},
	}},

	"jcode": {modelRequired: true, files: []cliToolFileSpec{
		{
			path:  inHome(".jcode", "config.toml"),
			label: "config.toml",
			merge: func(current []byte, cfg CLIToolConfig) ([]byte, error) {
				table := "providers." + cliProviderID
				block := tomlTable(table,
					"type", quote("openai-compatible"),
					"base_url", quote(v1(cfg)),
					"auth", quote("bearer"),
					"api_key_env", quote(jcodeKeyEnv),
					"env_file", quote("~/.config/jcode/"+jcodeEnvFile),
					"default_model", quote(cfg.Model),
					"requires_api_key", "true",
				) + "\n[[" + table + ".models]]\n" +
					"id = " + quote(cfg.Model) + "\n" +
					"name = " + quote(cfg.Model) + "\n"
				return []byte(tomlReplaceTable(string(current), table, block)), nil
			},
		},
		{
			path:  inHome(".config", "jcode", jcodeEnvFile),
			label: jcodeEnvFile,
			merge: func(current []byte, cfg CLIToolConfig) ([]byte, error) {
				return []byte(envSet(string(current), jcodeKeyEnv, cfg.APIKey)), nil
			},
			env: func(cfg CLIToolConfig) []CLIToolEnvVar {
				return []CLIToolEnvVar{{jcodeKeyEnv, cfg.APIKey, jcodeEnvFile}}
			},
		},
	}},

	"kilo-code": {modelRequired: true, files: []cliToolFileSpec{{
		path:  inHome(".local", "share", "kilo", "auth.json"),
		label: "auth.json",
		merge: jsonMerge(func(doc map[string]any, cfg CLIToolConfig) error {
			doc["openai-compatible"] = map[string]any{
				"type":    "api-key",
				"apiKey":  cfg.APIKey,
				"baseUrl": v1(cfg),
				"model":   cfg.Model,
			}
			return nil
		}),
	}}},

	"openclaw": {modelRequired: true, files: []cliToolFileSpec{{
		path:  inHome(".openclaw", "openclaw.json"),
		label: "openclaw.json",
		merge: jsonMerge(func(doc map[string]any, cfg CLIToolConfig) error {
			model, err := objectAt(doc, "agents", "defaults", "model")
			if err != nil {
				return err
			}
			model["primary"] = cliProviderID + "/" + cfg.Model
			providers, err := objectAt(doc, "models", "providers")
			if err != nil {
				return err
			}
			providers[cliProviderID] = map[string]any{
				"baseUrl": v1(cfg),
				"apiKey":  cfg.APIKey,
				"api":     "openai-completions",
				"models":  []any{map[string]any{"id": cfg.Model, "name": cfg.Model}},
			}
			return nil
		}),
	}}},

	"opencode": {modelRequired: true, files: []cliToolFileSpec{{
		path:  inHome(".config", "opencode", "opencode.json"),
		label: "opencode.json",
		merge: jsonMerge(func(doc map[string]any, cfg CLIToolConfig) error {
			providers, err := objectAt(doc, "provider")
			if err != nil {
				return err
			}
			providers[cliProviderID] = map[string]any{
				"npm":     "@ai-sdk/openai-compatible",
				"name":    cliProviderName,
				"options": map[string]any{"baseURL": v1(cfg), "apiKey": cfg.APIKey},
				"models":  map[string]any{cfg.Model: map[string]any{"name": cfg.Model}},
			}
			doc["model"] = cliProviderID + "/" + cfg.Model
			return nil
		}),
	}}},
}

const (
	jcodeKeyEnv  = "JCODE_TERA_ROUTER_API_KEY"
	jcodeEnvFile = "provider-tera-router.env"
)

// vscodeUserFile is a file in VS Code's per-user settings folder, which
// differs per OS.
func vscodeUserFile(name string) func(string) string {
	return func(home string) string {
		switch runtime.GOOS {
		case "darwin":
			return filepath.Join(home, "Library", "Application Support", "Code", "User", name)
		case "windows":
			if dir := os.Getenv("APPDATA"); dir != "" {
				return filepath.Join(dir, "Code", "User", name)
			}
		}
		return filepath.Join(home, ".config", "Code", "User", name)
	}
}

// CLIToolModelRequired reports whether the tool needs a model to work, and
// whether it is a tool the dashboard can configure at all.
func CLIToolModelRequired(id string) (required, ok bool) {
	spec, ok := cliToolSpecs[id]
	return spec.modelRequired, ok
}

// PreviewCLITool renders what configuring the tool writes into empty files,
// for copying by hand. A missing key or required model shows a placeholder.
func PreviewCLITool(id string, cfg CLIToolConfig) (CLIToolPlan, error) {
	spec, ok := cliToolSpecs[id]
	if !ok {
		return CLIToolPlan{}, ErrUnknownCLITool
	}
	if cfg.APIKey == "" {
		cfg.APIKey = CLIToolKeyPlaceholder
	}
	if cfg.Model == "" && spec.modelRequired {
		cfg.Model = CLIToolModelPlaceholder
	}

	home, _ := os.UserHomeDir()
	plan := CLIToolPlan{ModelRequired: spec.modelRequired, Files: []CLIToolFile{}, Env: []CLIToolEnvVar{}}
	for _, f := range spec.files {
		content, err := f.merge(nil, cfg)
		if err != nil {
			return CLIToolPlan{}, err
		}
		path := f.path(home)
		plan.Files = append(plan.Files, CLIToolFile{
			Path:        path,
			DisplayPath: shortenHome(home, path),
			Label:       f.label,
			Partial:     f.partial,
			Content:     string(content),
		})
		if f.env != nil {
			plan.Env = append(plan.Env, f.env(cfg)...)
		}
	}
	return plan, nil
}

// ApplyCLITool merges cfg into every config file of the tool. All files are
// read and merged before anything is written, so a file that cannot be
// parsed leaves every file untouched. beforeWrite runs between the two steps
// (e.g. to store the key the files will hold) and can still cancel.
func ApplyCLITool(id string, cfg CLIToolConfig, beforeWrite func() error) ([]string, error) {
	spec, ok := cliToolSpecs[id]
	if !ok {
		return nil, ErrUnknownCLITool
	}
	if cfg.Model == "" && spec.modelRequired {
		return nil, errors.New("pick a default model first")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("resolve home directory: %w", err)
	}

	type write struct {
		path string
		data []byte
	}
	writes := make([]write, 0, len(spec.files))
	for _, f := range spec.files {
		path := f.path(home)
		current, err := os.ReadFile(path)
		if err != nil && !errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("read %s: %w", path, err)
		}
		data, err := f.merge(current, cfg)
		if err != nil {
			return nil, fmt.Errorf("%s %w; fix or remove it first", path, err)
		}
		writes = append(writes, write{path, data})
	}

	if beforeWrite != nil {
		if err := beforeWrite(); err != nil {
			return nil, err
		}
	}
	paths := make([]string, 0, len(writes))
	for _, w := range writes {
		if err := writeFileAtomic(w.path, w.data); err != nil {
			return paths, err
		}
		paths = append(paths, w.path)
	}
	return paths, nil
}

func shortenHome(home, path string) string {
	if home != "" && strings.HasPrefix(path, home+string(filepath.Separator)) {
		return "~/" + filepath.ToSlash(strings.TrimPrefix(path, home+string(filepath.Separator)))
	}
	return path
}

// --- JSON ---

// jsonMerge parses the file as a JSON object (an empty or missing file is an
// empty object), applies set and re-encodes it. Anything that is not an
// object is refused so a file we cannot read is never overwritten.
func jsonMerge(set func(doc map[string]any, cfg CLIToolConfig) error) func([]byte, CLIToolConfig) ([]byte, error) {
	return func(current []byte, cfg CLIToolConfig) ([]byte, error) {
		doc := map[string]any{}
		if len(bytes.TrimSpace(current)) > 0 {
			if err := decodeJSON(current, &doc); err != nil || doc == nil {
				return nil, errors.New("is not a JSON object")
			}
		}
		if err := set(doc, cfg); err != nil {
			return nil, err
		}
		return encodeJSON(doc)
	}
}

// decodeJSON keeps numbers as written, so large integers survive the round trip.
func decodeJSON(raw []byte, v any) error {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	return dec.Decode(v)
}

func encodeJSON(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// objectAt returns the object at the key path, creating missing levels.
func objectAt(doc map[string]any, keys ...string) (map[string]any, error) {
	cur := doc
	for _, k := range keys {
		next, exists := cur[k]
		if !exists {
			obj := map[string]any{}
			cur[k] = obj
			cur = obj
			continue
		}
		obj, ok := next.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("has %q that is not an object", k)
		}
		cur = obj
	}
	return cur, nil
}

func arrayAt(doc map[string]any, key string) ([]any, error) {
	v, exists := doc[key]
	if !exists {
		return nil, nil
	}
	list, ok := v.([]any)
	if !ok {
		return nil, fmt.Errorf("has %q that is not an array", key)
	}
	return list, nil
}

// withoutEntry drops the objects whose field equals value, so writing again
// replaces our entry instead of adding a second one.
func withoutEntry(list []any, field, value string) []any {
	out := make([]any, 0, len(list)+1)
	for _, item := range list {
		if obj, ok := item.(map[string]any); ok && obj[field] == value {
			continue
		}
		out = append(out, item)
	}
	return out
}

// --- TOML, YAML and env files, edited line by line so comments survive ---

// quote renders s as a double-quoted string that TOML and YAML both read.
func quote(s string) string {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(s)
	return strings.TrimSpace(buf.String())
}

// optionalQuote quotes s, or returns "" (remove the key) when s is empty.
func optionalQuote(s string) string {
	if s == "" {
		return ""
	}
	return quote(s)
}

func splitLines(doc string) []string {
	doc = strings.TrimRight(doc, "\n")
	if doc == "" {
		return nil
	}
	return strings.Split(doc, "\n")
}

func joinLines(lines []string) string {
	if len(lines) == 0 {
		return ""
	}
	return strings.Join(lines, "\n") + "\n"
}

var tomlHeader = regexp.MustCompile(`^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(#.*)?$`)

// tomlSetTop sets a top-level key (before the first table) to the literal
// value, or removes it when value is "".
//
// ponytail: matches single-line `key = value` only; a multi-line value for
// the same key would be left half replaced.
func tomlSetTop(doc, key, value string) string {
	lines := splitLines(doc)
	keyLine := regexp.MustCompile(`^\s*` + regexp.QuoteMeta(key) + `\s*=`)
	end := len(lines)
	for i, l := range lines {
		if tomlHeader.MatchString(l) {
			end = i
			break
		}
	}
	for i := 0; i < end; i++ {
		if keyLine.MatchString(lines[i]) {
			if value == "" {
				return joinLines(append(lines[:i:i], lines[i+1:]...))
			}
			lines[i] = key + " = " + value
			return joinLines(lines)
		}
	}
	if value == "" {
		return joinLines(lines)
	}
	// Insert after the last top-level line, keeping one blank line before
	// the first table.
	at := end
	for at > 0 && strings.TrimSpace(lines[at-1]) == "" {
		at--
	}
	out := append([]string{}, lines[:at]...)
	out = append(out, key+" = "+value)
	if end < len(lines) {
		out = append(out, "")
		out = append(out, lines[end:]...)
	}
	return joinLines(out)
}

// tomlReplaceTable removes the table and every sub-table under name, then
// appends block.
func tomlReplaceTable(doc, name, block string) string {
	lines := splitLines(doc)
	var out []string
	skipping := false
	for _, l := range lines {
		if m := tomlHeader.FindStringSubmatch(l); m != nil {
			h := strings.ReplaceAll(m[1], " ", "")
			skipping = h == name || strings.HasPrefix(h, name+".")
		}
		if !skipping {
			out = append(out, l)
		}
	}
	for len(out) > 0 && strings.TrimSpace(out[len(out)-1]) == "" {
		out = out[:len(out)-1]
	}
	if len(out) > 0 {
		out = append(out, "")
	}
	return joinLines(out) + block
}

// tomlTable renders [name] followed by key = value pairs (values are literals).
func tomlTable(name string, pairs ...string) string {
	var b strings.Builder
	b.WriteString("[" + name + "]\n")
	for i := 0; i+1 < len(pairs); i += 2 {
		b.WriteString(pairs[i] + " = " + pairs[i+1] + "\n")
	}
	return b.String()
}

// yamlReplaceTop replaces the top-level key and its indented block with
// block, or appends block when the key is absent.
func yamlReplaceTop(doc, key, block string) string {
	lines := splitLines(doc)
	keyLine := regexp.MustCompile(`^` + regexp.QuoteMeta(key) + `\s*:`)
	for i, l := range lines {
		if !keyLine.MatchString(l) {
			continue
		}
		j := i + 1
		for j < len(lines) && (strings.TrimSpace(lines[j]) == "" || lines[j][0] == ' ' || lines[j][0] == '\t') {
			j++
		}
		// Blank lines before the next key stay with it.
		for j > i+1 && strings.TrimSpace(lines[j-1]) == "" {
			j--
		}
		out := append([]string{}, lines[:i]...)
		out = append(out, splitLines(block)...)
		out = append(out, lines[j:]...)
		return joinLines(out)
	}
	if len(lines) == 0 {
		return block
	}
	return joinLines(lines) + "\n" + block
}

// envSet sets KEY=value in a dotenv file, replacing an existing assignment.
func envSet(doc, key, value string) string {
	lines := splitLines(doc)
	keyLine := regexp.MustCompile(`^\s*(export\s+)?` + regexp.QuoteMeta(key) + `\s*=`)
	for i, l := range lines {
		if keyLine.MatchString(l) {
			lines[i] = key + "=" + value
			return joinLines(lines)
		}
	}
	return joinLines(append(lines, key+"="+value))
}

// writeFileAtomic replaces path with data via a temp file in the same
// folder. A new file is private (0600, folder 0700) since config files hold
// the key; an existing file keeps its mode.
func writeFileAtomic(path string, data []byte) error {
	mode := fs.FileMode(0o600)
	if info, err := os.Stat(path); err == nil {
		mode = info.Mode().Perm()
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create %s: %w", dir, err)
	}
	tmp, err := os.CreateTemp(dir, "."+filepath.Base(path)+"-*")
	if err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	defer os.Remove(tmp.Name())

	if _, err := tmp.Write(data); err != nil {
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
