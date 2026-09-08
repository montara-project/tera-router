package main

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/handlers"

	"github.com/gofiber/fiber/v2"
)

func routes(r *fiber.App, app *app.Application) {
	h := handlers.New(app)

	r.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Hello, World!",
		})
	})

	r.Get("/health", h.Health.Check)
}
