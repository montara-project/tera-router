package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/services"

	"github.com/gofiber/fiber/v3"
)

type quotaHandler struct {
	app *app.Application
}

// disabledOnly builds an empty input so the update only flips the flag.
func disabledOnly(disabled bool) services.AccountInput {
	return services.AccountInput{}
}

// Index lists every account as a quota row.
func (h *quotaHandler) Index(c fiber.Ctx) error {
	rows, err := h.app.Services.Quota.List(c.Context(), c.Query("range", "30d"))
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.TotalMeta(len(rows)))
}

// Overview returns the summary header plus rows (?range=today|7d|30d).
func (h *quotaHandler) Overview(c fiber.Ctx) error {
	summary, accounts, err := h.app.Services.Quota.Overview(c.Context(), c.Query("range", "30d"))
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"summary": summary, "accounts": accounts})
}

// Update toggles an account's enabled state (active ↔ paused).
func (h *quotaHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	account, err := h.app.Services.Accounts.Get(c.Context(), id.String())
	if err != nil {
		return err
	}

	disabled := !account.Disabled
	if _, err := h.app.Services.Accounts.Update(c.Context(), actorFrom(c), id.String(), disabledOnly(disabled), &disabled); err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"id": id.String()})
}

// Delete removes the account from the quota page.
func (h *quotaHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Services.Accounts.Delete(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"id": id.String()})
}
