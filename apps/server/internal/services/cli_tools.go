package services

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// CLIToolStatus is one row of GET /v1/cli-tools: whether the tool was found
// on this host and where.
type CLIToolStatus struct {
	ID        string `json:"id"`
	Installed bool   `json:"installed"`
	// Path is the binary or editor extension folder that was found.
	Path string `json:"path"`
}

// cliToolProbe says how to find a tool: a binary name, or an editor
// extension id prefix for tools that ship as VS Code extensions.
type cliToolProbe struct {
	id         string
	binaries   []string
	extensions []string
	// homeBins are installer locations under the home folder that are not
	// on PATH, e.g. Claude Code's native installer.
	homeBins []string
}

// cliToolProbes lists every tool on the CLI tools page, ids matching the web UI.
var cliToolProbes = []cliToolProbe{
	{id: "claude-code", binaries: []string{"claude"}, homeBins: []string{".claude/local/claude"}},
	{id: "cline-roo", extensions: []string{"saoudrizwan.claude-dev-", "rooveterinaryinc.roo-cline-"}},
	{id: "codex-cli", binaries: []string{"codex"}},
	{id: "deepseek-tui", binaries: []string{"deepseek-tui", "deepseek"}},
	{id: "factory-droid", binaries: []string{"droid"}},
	{id: "github-copilot", extensions: []string{"github.copilot-chat-"}},
	{id: "hermes-agent", binaries: []string{"hermes"}},
	{id: "jcode", binaries: []string{"jcode"}},
	{id: "kilo-code", extensions: []string{"kilocode.kilo-code-"}},
	{id: "openclaw", binaries: []string{"openclaw"}},
	{id: "opencode", binaries: []string{"opencode"}},
}

// extensionDirs are the editors whose extensions folder is checked.
var extensionDirs = []string{".vscode", ".vscode-insiders", ".cursor", ".windsurf"}

// DetectCLITools reports which of the supported coding tools are on this host.
func DetectCLITools() []CLIToolStatus {
	home, _ := os.UserHomeDir()
	return detectCLITools(home, func(name string) string { return findBinary(home, name) })
}

func detectCLITools(home string, find func(name string) string) []CLIToolStatus {
	out := make([]CLIToolStatus, 0, len(cliToolProbes))
	for _, p := range cliToolProbes {
		st := CLIToolStatus{ID: p.id}
		for _, name := range p.binaries {
			if path := find(name); path != "" {
				st.Installed, st.Path = true, path
				break
			}
		}
		for _, rel := range p.homeBins {
			if st.Installed || home == "" {
				break
			}
			if c := filepath.Join(home, rel); isExecutable(c) {
				st.Installed, st.Path = true, c
			}
		}
		if !st.Installed && home != "" {
			st.Path = findExtension(home, p.extensions)
			st.Installed = st.Path != ""
		}
		out = append(out, st)
	}
	return out
}

// findBinary looks on PATH first, then in the user bin folders installers
// use, since a service's PATH rarely includes them.
func findBinary(home, name string) string {
	if bin, err := exec.LookPath(name); err == nil {
		return bin
	}
	var candidates []string
	if home != "" {
		for _, dir := range []string{".local/bin", ".npm-global/bin", ".bun/bin", ".cargo/bin", "go/bin"} {
			candidates = append(candidates, filepath.Join(home, dir, name))
		}
	}
	candidates = append(candidates, filepath.Join("/usr/local/bin", name), filepath.Join("/opt/homebrew/bin", name))
	for _, c := range candidates {
		if isExecutable(c) {
			return c
		}
	}
	return ""
}

func isExecutable(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular() && info.Mode().Perm()&0o111 != 0
}

// findExtension returns the first installed extension folder whose name
// starts with one of the prefixes (folders are named "<id>-<version>").
func findExtension(home string, prefixes []string) string {
	if len(prefixes) == 0 {
		return ""
	}
	for _, editor := range extensionDirs {
		dir := filepath.Join(home, editor, "extensions")
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			name := strings.ToLower(e.Name())
			for _, prefix := range prefixes {
				if e.IsDir() && strings.HasPrefix(name, prefix) {
					return filepath.Join(dir, e.Name())
				}
			}
		}
	}
	return ""
}
