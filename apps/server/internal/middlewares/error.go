package middlewares

import (
	"errors"

	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
)

// ErrorHandler renders every handler error into the response envelope the
// web UI expects: {"message": "...", "errors": [...]} for validation and
// {"message": "..."} otherwise.
func ErrorHandler(c fiber.Ctx, err error) error {
	var validation *lib.ErrValidationFailed
	if errors.As(err, &validation) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(lib.WrapValidationError(validation.MessageRecord))
	}

	if errors.Is(err, fiber.ErrNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "route not found"})
	}
	if errors.Is(err, fiber.ErrMethodNotAllowed) {
		return c.Status(fiber.StatusMethodNotAllowed).JSON(fiber.Map{"message": "method not allowed"})
	}

	status, message := apperr.From(err)
	return c.Status(status).JSON(fiber.Map{"message": message})
}
