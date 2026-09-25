package lib

import (
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

func ContextGetUID(c fiber.Ctx) (uuid.UUID, error) {
	uid := fiber.Locals[string](c, "uid")
	if uid != "" {
		return uuid.MustParse(uid), nil
	}

	return uuid.Nil, errors.New("can't find get context auth, please check your authorization")
}

func ContextSetUID(c fiber.Ctx, uid uuid.UUID) {
	fiber.Locals[string](c, "uid", uid.String())
}

func ContextParamUUID(c fiber.Ctx, key string) (uuid.UUID, error) {
	str := c.Params(key)
	return uuid.Parse(str)
}
