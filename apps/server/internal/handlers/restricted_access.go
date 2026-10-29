package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/ipblock"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
)

type restrictedAccessHandler struct {
	app *app.Application
}

// Get returns the restricted access period (GET /v1/restricted-access).
func (h *restrictedAccessHandler) Get(c fiber.Ctx) error {
	stored, err := h.app.Repos.Settings.RestrictedAccess(c.Context())
	if err != nil {
		return err
	}
	return dtos.OK(c, stored)
}

// Update replaces the restricted access period (PUT /v1/restricted-access).
// Enabling it without the caller's own address on the allowlist is refused
// so an admin cannot lock themselves out.
func (h *restrictedAccessHandler) Update(c fiber.Ctx) error {
	var req dtos.RestrictedAccess
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	compiled, stored, err := ipblock.CompileRestriction(req.RestrictedAccess)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "%s", err.Error())
	}
	if self := lib.ContextClientIP(c); stored.Enabled && self.IsValid() && !self.Unmap().IsLoopback() && !compiled.Allows(self) {
		return apperr.New(apperr.KindBadRequest, "your own address (%s) is not on the allowlist", self.Unmap())
	}

	if err := h.app.Repos.Settings.SetRestrictedAccess(c.Context(), stored); err != nil {
		return err
	}
	if err := h.app.IPBlocks.Reload(c.Context()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "restricted_access.update", "restricted_access", stored)
	return dtos.Item(c, fiber.StatusOK, stored, "Restricted access updated")
}
