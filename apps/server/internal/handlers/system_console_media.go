package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
)

type consoleHandler struct {
	app *app.Application
}

// Index returns the console ring buffer, newest last.
func (h *consoleHandler) Index(c fiber.Ctx) error {
	entries := h.app.Services.Console.List()
	return dtos.List(c, entries, dtos.Metadata{})
}

// Clear empties the console feed.
func (h *consoleHandler) Clear(c fiber.Ctx) error {
	h.app.Services.Console.Clear()
	h.app.Services.Console.Push(services.LogLevelInfo, "Console cleared", "")
	return dtos.List(c, []services.ConsoleEntry{}, dtos.Metadata{})
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

type mediaHandler struct {
	app *app.Application
}

// Index returns the static media provider catalog.
func (h *mediaHandler) Index(c fiber.Ctx) error {
	return dtos.OK(c, fiber.Map{"providers": h.app.Services.Media.List()})
}
