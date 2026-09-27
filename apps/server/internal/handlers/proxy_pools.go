package handlers

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/validator"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

type proxyPoolsHandler struct {
	app *app.Application
}

type proxyPoolRequest struct {
	Name  string `json:"name"`
	URL   string `json:"url"`
	Mode  string `json:"mode"`
	Label string `json:"label"`
}

func (d *proxyPoolRequest) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String()
	v.Field("url").Required().String()
}

func poolView(p models.ProxyPool) fiber.Map {
	return fiber.Map{
		"id":         p.ID,
		"name":       p.Name,
		"url":        p.URL,
		"mode":       p.Mode,
		"label":      p.Label,
		"status":     p.Status,
		"testedAt":   p.LastTestedAt,
		"created_at": p.CreatedAt,
	}
}

func (h *proxyPoolsHandler) Index(c fiber.Ctx) error {
	pools, err := h.app.Services.ProxyPools.List(c.Context())
	if err != nil {
		return err
	}

	out := make([]fiber.Map, 0, len(pools))
	for _, p := range pools {
		out = append(out, poolView(p))
	}
	return dtos.List(c, out, dtos.TotalMeta(len(pools)))
}

func (h *proxyPoolsHandler) Store(c fiber.Ctx) error {
	var req proxyPoolRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	pool, err := h.app.Services.ProxyPools.Create(c.Context(), actorFrom(c), models.ProxyPool{
		Name:  req.Name,
		URL:   req.URL,
		Mode:  req.Mode,
		Label: req.Label,
	})
	if err != nil {
		return err
	}
	return dtos.Created(c, poolView(pool), "Proxy pool created")
}

func (h *proxyPoolsHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req proxyPoolRequest
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	pool, err := h.app.Services.ProxyPools.Update(c.Context(), actorFrom(c), models.ProxyPool{
		ID:    id.String(),
		Name:  req.Name,
		URL:   req.URL,
		Mode:  req.Mode,
		Label: req.Label,
	})
	if err != nil {
		return err
	}
	return dtos.OK(c, poolView(pool))
}

func (h *proxyPoolsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Services.ProxyPools.Delete(c.Context(), actorFrom(c), id.String()); err != nil {
		return err
	}
	return dtos.Deleted(c, "Proxy pool deleted")
}

// Test probes the pool's proxy and refreshes its tested timestamp.
func (h *proxyPoolsHandler) Test(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	pool, err := h.app.Services.ProxyPools.Test(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, poolView(pool))
}

// HealthCheck tests every pool at once.
func (h *proxyPoolsHandler) HealthCheck(c fiber.Ctx) error {
	tested, err := h.app.Services.ProxyPools.HealthCheck(c.Context(), actorFrom(c))
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"tested": tested})
}
