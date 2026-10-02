package handlers

import (
	"tera-router/server/internal/app"

	"github.com/gofiber/fiber/v3"
)

type healthHandler struct {
	app *app.Application
}

func (h *healthHandler) Check(c fiber.Ctx) error {
	v := fiber.Map{
		"machine_id": h.app.Config.App.MachineID,
		"status":     "ok",
		"version":    app.Version,
		"system_info": map[string]interface{}{
			"debug": h.app.Config.App.Debug,
		},
	}

	return c.Status(fiber.StatusOK).JSON(v)
}
