package handlers

import (
	"fmt"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/catalog"
	"tera-router/server/internal/dtos"

	"github.com/gofiber/fiber/v3"
)

type consoleHandler struct {
	app *app.Application
}

// Index returns the console ring buffer, newest last.
func (h *consoleHandler) Index(c fiber.Ctx) error {
	return dtos.List(c, ConsoleList(), dtos.Metadata{})
}

// Clear empties the console feed.
func (h *consoleHandler) Clear(c fiber.Ctx) error {
	ConsoleClear()
	ConsolePush(dtos.LogLevelInfo, "Console cleared", "")
	return dtos.List(c, []dtos.ConsoleEntry{}, dtos.Metadata{})
}

type systemHandler struct {
	app *app.Application
}

// Stats samples host, process, and runtime metrics with the rolling history.
func (h *systemHandler) Stats(c fiber.Ctx) error {
	stats, err := h.app.Services.System.Stats()
	if err != nil {
		return err
	}
	return dtos.OK(c, stats)
}

// processStartedAt approximates when the gateway started: package
// initialisation runs once, at boot.
var processStartedAt = time.Now()

// Status reports the running gateway for the dashboard's status card.
func (h *systemHandler) Status(c fiber.Ctx) error {
	return dtos.OK(c, buildSystemStatus(h.app.Config.App.Port, processStartedAt, time.Now()))
}

// buildSystemStatus assembles the status card. The server binds every
// interface (Listen(":port")), so the address is shown as 0.0.0.0:port.
func buildSystemStatus(port int, startedAt, now time.Time) dtos.SystemStatus {
	return dtos.SystemStatus{
		Status:        "running",
		Version:       app.Version,
		UptimeSeconds: int64(now.Sub(startedAt).Seconds()),
		ListenAddr:    fmt.Sprintf("0.0.0.0:%d", port),
		Database:      "SQLite",
	}
}

type mediaHandler struct {
	app *app.Application
}

// Index lists the catalog providers with a non-chat capability, so the Media
// page shows exactly the providers the Providers page can connect. Catalog
// "embeddings" is reported as the page's "embed"; the pinned custom-provider
// templates are left out.
func (h *mediaHandler) Index(c fiber.Ctx) error {
	providers := []dtos.MediaProvider{}
	for _, p := range catalog.Listed() {
		if p.Pinned {
			continue
		}
		caps := []string{}
		for _, cap := range p.Capabilities {
			switch cap {
			case "chat":
			case "embeddings":
				caps = append(caps, "embed")
			default:
				caps = append(caps, cap)
			}
		}
		if len(caps) > 0 {
			providers = append(providers, dtos.MediaProvider{ID: "media-" + p.Slug, Name: p.Name, Slug: p.Slug, Capabilities: caps})
		}
	}
	return dtos.OK(c, fiber.Map{"providers": providers})
}
