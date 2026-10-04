// Package services holds integrations with third-party systems only:
// host probing (gopsutil metrics, the Claude Code CLI and its settings file)
// and outbound HTTP to upstream AI providers and proxies. All internal
// business logic lives in repositories (data) and handlers (request
// orchestration).
package services

// Services aggregates the third-party integrations for injection into
// handlers.
type Services struct {
	System     *SystemService
	Upstream   *UpstreamService
	ClaudeCode *ClaudeCodeService
}

// New wires the third-party integrations.
func New() *Services {
	return &Services{
		System:     &SystemService{},
		Upstream:   &UpstreamService{},
		ClaudeCode: &ClaudeCodeService{},
	}
}
