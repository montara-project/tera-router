package handlers

import (
	"context"
	"fmt"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type proxyPoolsHandler struct {
	app *app.Application
}

func poolView(p models.ProxyPool) fiber.Map {
	return fiber.Map{
		"id":         p.ID,
		"name":       p.Name,
		"url":        p.URL,
		"mode":       p.Mode,
		"label":      p.Label,
		"status":     p.Status,
		"tested_at":  p.LastTestedAt,
		"created_at": p.CreatedAt,
	}
}

func (h *proxyPoolsHandler) Index(c fiber.Ctx) error {
	pools, err := h.app.Repos.ProxyPools.List(c.Context())
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
	var req dtos.ProxyPool
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	pool := models.ProxyPool{ID: uuid.NewString(), Name: req.Name, URL: req.URL, Mode: req.Mode, Label: req.Label, Status: "active"}
	if err := h.app.Repos.ProxyPools.Insert(c.Context(), pool); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "proxy_pool.create", pool.ID, map[string]string{"url": pool.URL})
	return dtos.Created(c, poolView(pool), "Proxy pool created")
}

func (h *proxyPoolsHandler) Get(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	pool, err := h.app.Repos.ProxyPools.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	return dtos.OK(c, poolView(pool))
}

func (h *proxyPoolsHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	var req dtos.ProxyPool
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	// Status/last_tested_at are owned by the health check (UpdateTestedAt), so
	// carry the stored values through instead of blanking them.
	stored, err := h.app.Repos.ProxyPools.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	pool := models.ProxyPool{
		ID: id.String(), Name: req.Name, URL: req.URL, Mode: req.Mode, Label: req.Label,
		Status: stored.Status, LastTestedAt: stored.LastTestedAt,
	}
	if err := h.app.Repos.ProxyPools.Update(c.Context(), pool); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "proxy_pool.update", pool.ID, nil)

	updated, err := h.app.Repos.ProxyPools.Get(c.Context(), pool.ID)
	if err != nil {
		return err
	}
	return dtos.OK(c, poolView(updated))
}

func (h *proxyPoolsHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Repos.ProxyPools.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "proxy_pool.delete", id.String(), nil)
	return dtos.Deleted(c, "Proxy pool deleted")
}

// Test probes the pool's proxy and records the outcome, mirroring IDRouter's
// proxy-pool test endpoint.
func (h *proxyPoolsHandler) Test(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	pool, err := h.app.Repos.ProxyPools.Get(c.Context(), id.String())
	if err != nil {
		return err
	}

	updated, err := h.testPool(c.Context(), pool)
	if err != nil {
		return err
	}
	return dtos.OK(c, poolView(updated))
}

// HealthCheck tests every pool at once, returning how many were tested.
func (h *proxyPoolsHandler) HealthCheck(c fiber.Ctx) error {
	pools, err := h.app.Repos.ProxyPools.List(c.Context())
	if err != nil {
		return err
	}
	for _, pool := range pools {
		if _, err := h.testPool(c.Context(), pool); err != nil {
			return err
		}
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "proxy_pool.health_check", fmt.Sprintf("%d pools", len(pools)), nil)
	return dtos.OK(c, fiber.Map{"tested": len(pools)})
}

// testPool probes one pool via the upstream service and persists the outcome.
func (h *proxyPoolsHandler) testPool(ctx context.Context, pool models.ProxyPool) (models.ProxyPool, error) {
	status := "inactive"
	if ok, err := h.app.Services.Upstream.TestProxy(ctx, pool.URL); err == nil && ok {
		status = "active"
	}
	if err := h.app.Repos.ProxyPools.UpdateTestedAt(ctx, pool.ID, time.Now(), status); err != nil {
		return models.ProxyPool{}, err
	}
	return h.app.Repos.ProxyPools.Get(ctx, pool.ID)
}
