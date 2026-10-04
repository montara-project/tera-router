package handlers

import (
	"context"
	"errors"
	"net/url"
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
)

type cliToolsHandler struct {
	app *app.Application
}

// claudeCodeView is the GET /v1/cli-tools/claude-code payload: the host
// status plus the id of the API key whose plaintext is the configured
// ANTHROPIC_AUTH_TOKEN (nil when unset or not one of ours).
type claudeCodeView struct {
	services.ClaudeCodeStatus
	CurrentKeyID *string `json:"current_key_id"`
}

// ClaudeCode reports whether the Claude Code CLI is installed on this host
// and what its settings file currently points at.
func (h *cliToolsHandler) ClaudeCode(c fiber.Ctx) error {
	view, err := h.claudeCodeView(c.Context())
	if err != nil {
		return err
	}
	return dtos.OK(c, view)
}

// ClaudeCodeApply writes the gateway URL, the chosen API key's plaintext, and
// the optional default model into the host's Claude Code settings file.
func (h *cliToolsHandler) ClaudeCodeApply(c fiber.Ctx) error {
	var req dtos.ApplyClaudeCode
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	baseURL := strings.TrimRight(strings.TrimSpace(req.BaseURL), "/")
	if u, err := url.Parse(baseURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return apperr.New(apperr.KindUnprocessable, "endpoint URL must be an absolute http(s) URL")
	}

	key, err := h.app.Repos.APIKeys.Get(c.Context(), req.KeyID)
	if err != nil {
		return err
	}
	if key.Disabled {
		return apperr.New(apperr.KindUnprocessable, "API key %q is disabled", key.Name)
	}
	if key.Secret.Empty() {
		return apperr.New(apperr.KindUnprocessable, "API key %q has no recoverable secret", key.Name)
	}
	token, err := h.app.Secrets.OpenString(key.Secret)
	if err != nil {
		return err
	}

	model := strings.TrimSpace(req.Model)
	if err := h.app.Services.ClaudeCode.Apply(services.ClaudeCodeConfig{
		BaseURL:   baseURL,
		AuthToken: token,
		Model:     model,
	}); err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "cli_tool.apply", "claude-code", map[string]string{
		"base_url": baseURL,
		"key_id":   key.ID,
		"model":    model,
	})

	view, err := h.claudeCodeView(c.Context())
	if err != nil {
		return err
	}
	return dtos.Item(c, fiber.StatusOK, view, "Claude Code configured")
}

func (h *cliToolsHandler) claudeCodeView(ctx context.Context) (claudeCodeView, error) {
	status, err := h.app.Services.ClaudeCode.Status(ctx)
	if err != nil {
		return claudeCodeView{}, err
	}
	view := claudeCodeView{ClaudeCodeStatus: status}
	if status.AuthToken == "" {
		return view, nil
	}
	key, err := h.app.Repos.APIKeys.GetByLookup(ctx, apikey.LookupHash(status.AuthToken))
	if errors.Is(err, apperr.ErrNotFound) {
		return view, nil
	}
	if err != nil {
		return claudeCodeView{}, err
	}
	view.CurrentKeyID = &key.ID
	return view, nil
}
