package main

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/handlers"

	"github.com/getsentry/sentry-go"
	"github.com/gofiber/fiber/v2"
)

func routes(r *fiber.App, app *app.Application) {
	h := handlers.New(app)

	r.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Hello, World!",
		})
	})

	if app.Config.App.Debug {
		r.Get("/get-error", func(c *fiber.Ctx) error {
			sentry.CaptureMessage("It works!")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Internal Server Error",
			})
		})
	}

	r.Get("/health", h.Health.Check)
}
