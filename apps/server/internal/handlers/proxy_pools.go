package handlers

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/connectors"
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

	pool := newPool(req)
	if err := h.app.Repos.ProxyPools.Insert(c.Context(), pool); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "proxy_pool.create", pool.ID, map[string]string{"url": pool.URL})
	return dtos.Created(c, poolView(pool), "Proxy pool created")
}

// newPool builds a pool from a request, tagging relay URLs with the relay mode.
func newPool(req dtos.ProxyPool) models.ProxyPool {
	return models.ProxyPool{
		ID:     uuid.NewString(),
		Name:   strings.TrimSpace(req.Name),
		URL:    strings.TrimSpace(req.URL),
		Mode:   poolMode(req),
		Label:  strings.TrimSpace(req.Label),
		Status: "active",
	}
}

func poolMode(req dtos.ProxyPool) string {
	if connectors.IsRelayURL(req.URL) {
		return "relay"
	}
	return strings.TrimSpace(req.Mode)
}

// Update rewrites a pool's name, URL, mode and label.
func (h *proxyPoolsHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}
	var req dtos.ProxyPool
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}

	pool, err := h.app.Repos.ProxyPools.Get(c.Context(), id.String())
	if err != nil {
		return err
	}
	pool.Name = strings.TrimSpace(req.Name)
	pool.URL = strings.TrimSpace(req.URL)
	pool.Mode = poolMode(req)
	pool.Label = strings.TrimSpace(req.Label)
	if err := h.app.Repos.ProxyPools.Update(c.Context(), pool); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "proxy_pool.update", pool.ID, map[string]string{"url": pool.URL})
	return dtos.Item(c, fiber.StatusOK, poolView(pool), "Proxy pool updated")
}

// maxProxyPoolBatch caps one batch import or bulk delete.
const maxProxyPoolBatch = 500

// BulkStore imports several pools in one transaction.
func (h *proxyPoolsHandler) BulkStore(c fiber.Ctx) error {
	var req dtos.ProxyPoolBulk
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	if len(req.Pools) == 0 || len(req.Pools) > maxProxyPoolBatch {
		return apperr.New(apperr.KindBadRequest, "send between 1 and %d proxy pools", maxProxyPoolBatch)
	}

	pools := make([]models.ProxyPool, 0, len(req.Pools))
	for i, item := range req.Pools {
		pool := newPool(item)
		if pool.Name == "" || pool.URL == "" {
			return apperr.New(apperr.KindUnprocessable, "pool %d needs a name and a URL", i+1)
		}
		pools = append(pools, pool)
	}
	if err := h.app.Repos.ProxyPools.InsertMany(c.Context(), pools); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "proxy_pool.bulk_create", fmt.Sprintf("%d pools", len(pools)), nil)

	out := make([]fiber.Map, 0, len(pools))
	for _, p := range pools {
		out = append(out, poolView(p))
	}
	return dtos.Item(c, fiber.StatusCreated, out, fmt.Sprintf("Imported %d %s", len(pools), pluralize(int64(len(pools)), "proxy pool", "proxy pools")))
}

// BulkDelete removes several pools, skipping ids that are already gone.
func (h *proxyPoolsHandler) BulkDelete(c fiber.Ctx) error {
	var req dtos.ProxyPoolBulkDelete
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	if len(req.IDs) == 0 || len(req.IDs) > maxProxyPoolBatch {
		return apperr.New(apperr.KindBadRequest, "send between 1 and %d proxy pool ids", maxProxyPoolBatch)
	}

	deleted := []string{}
	seen := make(map[string]bool, len(req.IDs))
	for _, raw := range req.IDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			return apperr.New(apperr.KindBadRequest, "invalid proxy pool id %q", raw)
		}
		if seen[id.String()] {
			continue
		}
		seen[id.String()] = true
		err = h.app.Repos.ProxyPools.Delete(c.Context(), id.String())
		if errors.Is(err, apperr.ErrNotFound) {
			continue
		}
		if err != nil {
			return err
		}
		deleted = append(deleted, id.String())
		auditRecord(c.Context(), h.app, actorFrom(c), "proxy_pool.delete", id.String(), map[string]any{"bulk": true})
	}
	return dtos.Item(c, fiber.StatusOK, fiber.Map{"deleted": deleted},
		fmt.Sprintf("Deleted %d %s", len(deleted), pluralize(int64(len(deleted)), "proxy pool", "proxy pools")))
}

//go:embed relayscripts/*
var relayScripts embed.FS

// relayKinds maps a relay kind to its script template, download filename and
// the pool URL to register once it runs (RELAY_HOST is the user's host).
var relayKinds = map[string]struct{ template, filename, endpoint string }{
	"cloudflare": {"relayscripts/cloudflare-worker.js", "worker.js", "https://RELAY_HOST.workers.dev"},
	"local":      {"relayscripts/local-relay.mjs", "relay.mjs", "http://RELAY_HOST:8790"},
}

// RelayScript generates a relay script with a fresh shared secret. The secret
// is new and stored nowhere until the user registers the pool URL, so this does
// not hand out an existing credential.
func (h *proxyPoolsHandler) RelayScript(c fiber.Ctx) error {
	var req dtos.RelayScript
	if err := lib.ValidateRequestBody(c, &req); err != nil {
		return err
	}
	kind, ok := relayKinds[req.Kind]
	if !ok {
		return apperr.New(apperr.KindUnprocessable, "relay kind must be cloudflare or local")
	}

	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return err
	}
	secret := hex.EncodeToString(raw)

	tmpl, err := relayScripts.ReadFile(kind.template)
	if err != nil {
		return err
	}
	poolURL, err := connectors.RelayURL(kind.endpoint, secret)
	if err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{
		"kind":     req.Kind,
		"filename": kind.filename,
		"script":   strings.ReplaceAll(string(tmpl), "__TERA_RELAY_SECRET__", secret),
		"pool_url": poolURL,
	})
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
