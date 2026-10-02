package main

import (
	"tera-router/server/internal/app"
	"tera-router/server/internal/gateway"
	"tera-router/server/internal/handlers"
	"tera-router/server/internal/middlewares"

	"github.com/getsentry/sentry-go"
	"github.com/gofiber/fiber/v3"
)

// routes registers every HTTP route and returns the inference gateway so the
// caller can drain its pending accounting on shutdown.
func routes(r *fiber.App, app *app.Application) *gateway.Server {
	h := handlers.New(app)

	if app.Config.App.Debug {
		r.Get("/get-error", func(c fiber.Ctx) error {
			sentry.CaptureMessage("It works!")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Internal Server Error",
			})
		})
	}

	r.Get("/health", h.Health.Check)

	// Inference gateway: /v1/chat/completions, /v1/messages,
	// /v1/messages/count_tokens, /v1/responses (+ root /responses). It
	// authenticates with API keys, not the dashboard's JWT, and is registered
	// before the dashboard's authenticated /v1 group so RequireAuth never
	// intercepts it.
	gw := gateway.Register(r, app)

	// Versioned dashboard API. Auth endpoints are public; everything else
	// requires the Bearer JWT issued by /v1/auth/sign-in.
	v1 := r.Group("/v1")

	v1.Post("/auth/sign-in", h.Auth.SignIn)
	v1.Post("/auth/refresh", h.Auth.Refresh)
	v1.Get("/auth/google/redirect", h.Auth.GoogleRedirect)

	protected := v1.Group("/", middlewares.RequireAuth(app))

	// Auth
	protected.Get("/auth/me", h.Auth.Me)
	protected.Post("/auth/sign-out", h.Auth.SignOut)

	// Keys & plans
	protected.Get("/keys", h.Keys.Index)
	protected.Post("/keys", h.Keys.Store)
	protected.Get("/keys/:id", h.Keys.Get)
	protected.Put("/keys/:id", h.Keys.Update)
	protected.Patch("/keys/:id", h.Keys.Update)
	protected.Post("/keys/:id/reveal", h.Keys.Reveal)
	protected.Delete("/keys/:id", h.Keys.Delete)

	protected.Get("/plans", h.Plans.Index)
	protected.Post("/plans", h.Plans.Store)
	protected.Get("/plans/:id", h.Plans.Get)
	protected.Get("/plans/:id/keys", h.Plans.Keys)
	protected.Put("/plans/:id", h.Plans.Update)
	protected.Patch("/plans/:id", h.Plans.Update)
	protected.Delete("/plans/:id", h.Plans.Delete)

	// Routing
	protected.Get("/chains", h.Chains.Index)
	protected.Post("/chains", h.Chains.Store)
	protected.Get("/chains/:id", h.Chains.Get)
	protected.Get("/chains/:id/usage", h.Chains.Usage)
	protected.Put("/chains/:id", h.Chains.Update)
	protected.Patch("/chains/:id", h.Chains.Update)
	protected.Delete("/chains/:id", h.Chains.Delete)

	protected.Get("/models/alias", h.Chains.AliasIndex)
	protected.Put("/models/alias", h.Chains.AliasPut)
	protected.Delete("/models/alias/:name", h.Chains.AliasDelete)

	// Providers & accounts
	protected.Get("/providers", h.Providers.Index)
	protected.Get("/providers/rates", h.Providers.Rates)
	protected.Get("/custom-providers", h.Providers.CustomIndex)
	protected.Post("/custom-providers", h.Providers.CustomStore)
	protected.Put("/custom-providers/:id", h.Providers.CustomUpdate)
	protected.Patch("/custom-providers/:id", h.Providers.CustomUpdate)
	protected.Delete("/custom-providers/:id", h.Providers.CustomDelete)
	protected.Get("/custom-providers/:id/models", h.Providers.CustomModels)
	protected.Post("/custom-providers/:id/models/sync", h.Providers.CustomModelsSync)
	protected.Patch("/custom-providers/:id/models", h.Providers.CustomModelsUpdate)
	protected.Post("/custom-providers/:id/models/test", h.Providers.CustomModelTest)

	// Catalog provider model catalog + sync (openrouter, ollama, ollama-local,
	// cline): provider slug as :id.
	protected.Get("/providers/:id/models", h.Providers.CatalogModels)
	protected.Post("/providers/:id/models/sync", h.Providers.ModelsSync)
	protected.Patch("/providers/:id/models", h.Providers.CatalogModelsUpdate)
	protected.Post("/providers/:id/models/test", h.Providers.CatalogModelTest)

	protected.Post("/validate-key", h.Accounts.ValidateKey)
	protected.Get("/accounts", h.Accounts.Index)
	protected.Post("/accounts", h.Accounts.Store)
	protected.Post("/accounts/bulk", h.Accounts.Bulk)
	protected.Get("/accounts/:id", h.Accounts.Get)
	protected.Put("/accounts/:id", h.Accounts.Update)
	protected.Patch("/accounts/:id", h.Accounts.Update)
	protected.Delete("/accounts/:id", h.Accounts.Delete)
	protected.Post("/accounts/:id/test", h.Accounts.Test)
	protected.Post("/accounts/:id/reveal", h.Accounts.Reveal)
	protected.Get("/accounts/:id/quota", h.Accounts.Quota)
	protected.Post("/accounts/:id/quota/reset", h.Accounts.QuotaReset)

	// Provider-scoped bulk account operations (provider slug as :id).
	protected.Post("/providers/:id/accounts/disable-all", h.Providers.AccountsBulkDisable)
	protected.Post("/providers/:id/accounts/enable-all", h.Providers.AccountsBulkEnable)
	protected.Delete("/providers/:id/accounts/disabled", h.Providers.AccountsBulkDeleteDisabled)
	protected.Delete("/providers/:id/accounts/all", h.Providers.AccountsBulkDeleteAll)

	// OAuth connection flows (claude, codex): start a PKCE flow against the
	// provider's official web, then exchange the returned code for sealed
	// tokens. Codex additionally captures its fixed loopback redirect on
	// localhost:1455/1457 via an in-process listener.
	protected.Get("/oauth/providers", h.OAuth.ListProviders)
	protected.Post("/oauth/:provider/authorize", h.OAuth.Authorize)
	protected.Post("/oauth/:provider/exchange", h.OAuth.Exchange)

	// Budgets & usage
	protected.Get("/budgets", h.Budgets.Index)
	protected.Get("/budgets/status", h.Budgets.Status)
	protected.Post("/budgets", h.Budgets.Store)
	protected.Put("/budgets/:id", h.Budgets.Update)
	protected.Patch("/budgets/:id", h.Budgets.Update)
	protected.Delete("/budgets/:id", h.Budgets.Delete)

	protected.Get("/usage", h.Usage.Summary)
	protected.Get("/usage/models", h.Usage.Models)
	protected.Get("/usage/insights", h.Usage.Insights)
	protected.Get("/usage/telemetry", h.Usage.Telemetry)

	// Quota dashboard
	protected.Get("/quota", h.Quota.Index)
	protected.Get("/quota/overview", h.Quota.Overview)
	protected.Patch("/quota/:id", h.Quota.Update)
	protected.Delete("/quota/:id", h.Quota.Delete)

	// Provider health (derived from gateway attempt outcomes)
	protected.Get("/provider-health", h.ProviderHealth.Overview)

	// Proxy pools
	protected.Get("/proxy-pools", h.ProxyPools.Index)
	protected.Post("/proxy-pools", h.ProxyPools.Store)
	protected.Post("/proxy-pools/health-check", h.ProxyPools.HealthCheck)
	protected.Put("/proxy-pools/:id", h.ProxyPools.Update)
	protected.Patch("/proxy-pools/:id", h.ProxyPools.Update)
	protected.Delete("/proxy-pools/:id", h.ProxyPools.Delete)
	protected.Post("/proxy-pools/:id/test", h.ProxyPools.Test)

	// Overrides
	protected.Get("/model-pricing-overrides", h.Priming.PricingIndex)
	protected.Post("/model-pricing-overrides", h.Priming.PricingUpsert)
	protected.Delete("/model-pricing-overrides", h.Priming.PricingDelete)

	protected.Get("/capability-overrides", h.Priming.CapabilityIndex)
	protected.Put("/capability-overrides", h.Priming.CapabilityPut)
	protected.Delete("/capability-overrides/:provider/:model", h.Priming.CapabilityDelete)
	protected.Post("/capability-overrides/reset", h.Priming.CapabilityReset)

	// Guardrails (content-safety policies, layered global → provider →
	// model → chain → key; most specific wins)
	protected.Get("/guardrails", h.Guardrails.Overview)
	protected.Post("/guardrails", h.Guardrails.Store)
	protected.Put("/guardrails/settings", h.Guardrails.UpdateSettings)
	protected.Post("/guardrails/evaluate", h.Guardrails.Evaluate)
	protected.Put("/guardrails/:id", h.Guardrails.Update)
	protected.Patch("/guardrails/:id", h.Guardrails.Update)
	protected.Delete("/guardrails/:id", h.Guardrails.Delete)

	// Settings, skills, console, system, media
	protected.Get("/settings", h.Settings.Get)
	protected.Put("/settings", h.Settings.Update)
	protected.Patch("/settings", h.Settings.Update)

	protected.Get("/skills", h.Skills.Index)
	protected.Post("/skills", h.Skills.Store)
	protected.Delete("/skills/:id", h.Skills.Delete)

	protected.Get("/console", h.Console.Index)
	protected.Delete("/console", h.Console.Clear)

	protected.Get("/system/stats", h.System.Stats)

	protected.Get("/media", h.Media.Index)

	return gw
}
