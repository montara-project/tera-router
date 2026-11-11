package handlers

import (
	"errors"
	"net/url"
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type cliToolsHandler struct {
	app *app.Application
}

// cliToolView is the GET /v1/cli-tools/:id payload: whether the tool is on
// this host, and the files configuring it writes.
type cliToolView struct {
	services.CLIToolStatus
	services.CLIToolPlan
}

// List reports which supported coding tools are installed on this host.
func (h *cliToolsHandler) List(c fiber.Ctx) error {
	return dtos.OK(c, services.DetectCLITools())
}

// Show reports one tool's install status and previews its config for the
// base_url and model query values, with a placeholder key
// (GET /v1/cli-tools/:id).
func (h *cliToolsHandler) Show(c fiber.Ctx) error {
	id := c.Params("id")
	base := strings.TrimRight(strings.TrimSpace(c.Query("base_url")), "/")
	if base == "" {
		base = c.BaseURL()
	}
	plan, err := services.PreviewCLITool(id, services.CLIToolConfig{
		BaseURL: base,
		Model:   strings.TrimSpace(c.Query("model")),
	})
	if errors.Is(err, services.ErrUnknownCLITool) {
		return apperr.New(apperr.KindNotFound, "no CLI tool %q", id)
	}
	if err != nil {
		return err
	}

	view := cliToolView{CLIToolStatus: services.CLIToolStatus{ID: id}, CLIToolPlan: plan}
	for _, st := range services.DetectCLITools() {
		if st.ID == id {
			view.CLIToolStatus = st
		}
	}
	return dtos.OK(c, view)
}

// Apply writes the gateway URL, a key and the model into the tool's config
// files on this host (POST /v1/cli-tools/:id/apply). With key_name a new key
// is created for the tool, so it can be revoked on its own; with api_key the
// pasted key is used and must be an active key of this gateway.
func (h *cliToolsHandler) Apply(c fiber.Ctx) error {
	id := c.Params("id")
	modelRequired, ok := services.CLIToolModelRequired(id)
	if !ok {
		return apperr.New(apperr.KindNotFound, "no CLI tool %q", id)
	}

	var req dtos.ApplyCLITool
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	baseURL := strings.TrimRight(strings.TrimSpace(req.BaseURL), "/")
	if u, err := url.Parse(baseURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return apperr.New(apperr.KindUnprocessable, "endpoint URL must be an absolute http(s) URL")
	}
	model := strings.TrimSpace(req.Model)
	if modelRequired && model == "" {
		return apperr.New(apperr.KindUnprocessable, "pick a default model first")
	}
	keyName := strings.TrimSpace(req.KeyName)
	pasted := strings.TrimSpace(req.APIKey)
	if (keyName == "") == (pasted == "") {
		return apperr.New(apperr.KindUnprocessable, "name the new key or paste an existing one")
	}

	cfg := services.CLIToolConfig{BaseURL: baseURL, Model: model}
	var key models.APIKey
	stored := false
	storeKey := func() error { return nil }
	if pasted != "" {
		found, err := h.app.Repos.APIKeys.GetByLookup(c.Context(), apikey.LookupHash(pasted))
		if errors.Is(err, apperr.ErrNotFound) || (err == nil && found.Disabled) {
			return apperr.New(apperr.KindUnprocessable, "that key is not an active key of this gateway; create one on the API keys page")
		}
		if err != nil {
			return err
		}
		key, cfg.APIKey = found, pasted
	} else {
		gen, err := apikey.Generate()
		if err != nil {
			return err
		}
		sealed, err := h.app.Secrets.SealString(gen.Plaintext, sealer.PurposeAPIKey)
		if err != nil {
			return err
		}
		key = models.APIKey{
			ID:         uuid.NewString(),
			Name:       keyName,
			KeyHash:    gen.Hash,
			LookupHash: gen.Lookup,
			Display:    gen.Display,
			Secret:     sealed,
		}
		cfg.APIKey = gen.Plaintext
		// The key is stored only once every file has parsed, so a config we
		// refuse to touch leaves no unused key behind.
		storeKey = func() error {
			if err := h.app.Repos.APIKeys.Insert(c.Context(), key); err != nil {
				return err
			}
			stored = true
			return nil
		}
	}

	files, err := services.ApplyCLITool(id, cfg, storeKey)
	if stored {
		auditRecord(c, actorFrom(c), "key.create", key.ID, map[string]string{"name": key.Name, "for": id})
	}
	if err != nil {
		if len(files) > 0 {
			return apperr.New(apperr.KindUnprocessable, "%s (already written: %s)", err.Error(), strings.Join(files, ", "))
		}
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	auditRecord(c, actorFrom(c), "cli_tool.apply", id, map[string]any{
		"base_url": baseURL,
		"key_id":   key.ID,
		"model":    model,
		"files":    files,
	})
	return dtos.Item(c, fiber.StatusOK, fiber.Map{
		"files": files,
		"key":   fiber.Map{"id": key.ID, "name": key.Name},
	}, "Config written")
}
