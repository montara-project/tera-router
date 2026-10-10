package gateway

import (
	"context"
	"strings"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"
)

// injectSkills appends skill prompts to the request's system prompt: every
// globally enabled skill, plus the ones selected on the API key that made the
// request. The codecs render System in each upstream's own form.
func (s *Server) injectSkills(ctx context.Context, req *core.ChatRequest, keyID string) error {
	skills, err := s.app.Repos.Skills.ListForKey(ctx, keyID)
	if err != nil {
		return err
	}
	req.System = appendSkills(req.System, skills)
	return nil
}

// appendSkills joins the skills' prompts after the client's own system
// prompt, each separated by a blank line. The client's text stays first so
// router-set prefixes on System (the Claude Code preamble) still match.
func appendSkills(system string, skills []models.Skill) string {
	parts := []string{}
	if strings.TrimSpace(system) != "" {
		parts = append(parts, system)
	}
	for _, sk := range skills {
		if p := strings.TrimSpace(sk.Prompt); p != "" {
			parts = append(parts, p)
		}
	}
	if len(parts) == 0 {
		return system
	}
	return strings.Join(parts, "\n\n")
}
