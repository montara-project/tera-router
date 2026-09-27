package dtos

import (
	"github.com/gofiber/fiber/v3"
)

// Metadata mirrors the web UI metadata type: an open map with conventional
// keys (total, offset, limit, page, per_page, from, to).
type Metadata map[string]interface{}

// ListMeta builds the conventional offset/limit pagination metadata.
func ListMeta(total, offset, limit int) Metadata {
	return Metadata{"total": total, "offset": offset, "limit": limit}
}

// TotalMeta builds metadata carrying only the row count.
func TotalMeta(total int) Metadata {
	return Metadata{"total": total}
}

// Item renders the single-resource envelope {data, metadata, message?}.
func Item(c fiber.Ctx, status int, data any, message string) error {
	body := fiber.Map{"data": data, "metadata": Metadata{}}
	if message != "" {
		body["message"] = message
	}
	return c.Status(status).JSON(body)
}

// OK renders a 200 single-resource envelope without a message.
func OK(c fiber.Ctx, data any) error {
	return Item(c, fiber.StatusOK, data, "")
}

// Created renders a 201 single-resource envelope with a message.
func Created(c fiber.Ctx, data any, message string) error {
	return Item(c, fiber.StatusCreated, data, message)
}

// List renders the collection envelope {data, metadata}.
func List(c fiber.Ctx, data any, meta Metadata) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"data": data, "metadata": meta})
}

// Deleted renders the delete envelope {message}.
func Deleted(c fiber.Ctx, message string) error {
	body := fiber.Map{}
	if message != "" {
		body["message"] = message
	}
	return c.Status(fiber.StatusOK).JSON(body)
}

// Message renders the bare {message} envelope (accepted for updates that
// return no payload).
func Message(c fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{"message": message})
}
