package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/ipblock"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"

	"github.com/gofiber/fiber/v3"
)

type ipBlocksHandler struct {
	app *app.Application
}

// Index lists the active blocks, manual and automatic (GET /v1/ip-blocks).
func (h *ipBlocksHandler) Index(c fiber.Ctx) error {
	rows, err := h.app.Repos.IPBlocks.ListActive(c.Context())
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.ListMeta(len(rows), 0, len(rows)))
}

// Store adds a permanent block (POST /v1/ip-blocks). A range covering the
// caller's own address is refused so an admin cannot lock themselves out.
func (h *ipBlocksHandler) Store(c fiber.Ctx) error {
	var req dtos.IPBlock
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	prefix, err := ipblock.ParsePrefix(req.CIDR)
	if err != nil {
		return apperr.New(apperr.KindBadRequest, "enter an IP address or CIDR range, e.g. 203.0.113.7 or 10.0.0.0/8")
	}
	if self := lib.ContextClientIP(c); self.IsValid() && prefix.Contains(self.Unmap()) {
		return apperr.New(apperr.KindBadRequest, "this range includes your own address (%s)", self.Unmap())
	}

	id, err := h.app.Repos.IPBlocks.Insert(c.Context(), prefix.String(), req.Reason)
	if err != nil {
		return err
	}
	if err := h.app.IPBlocks.Reload(c.Context()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "ip_block.create", id, map[string]string{"cidr": prefix.String()})
	return dtos.Item(c, fiber.StatusCreated, fiber.Map{"id": id, "cidr": prefix.String()}, "Address blocked")
}

// Delete lifts a block (DELETE /v1/ip-blocks/:id).
func (h *ipBlocksHandler) Delete(c fiber.Ctx) error {
	id := c.Params("id")
	if err := h.app.Repos.IPBlocks.Delete(c.Context(), id); err != nil {
		return err
	}
	if err := h.app.IPBlocks.Reload(c.Context()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "ip_block.delete", id, nil)
	return dtos.Message(c, fiber.StatusOK, "Block removed")
}
