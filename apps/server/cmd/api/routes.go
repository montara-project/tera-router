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

	// Skill documents an AI agent fetches by URL (reference guides and custom
	// skills). Public: agents request them without credentials.
	r.Get("/skills/:slug/SKILL.md", h.Skills.Document)

	// Inference gateway: /v1/chat/completions, /v1/messages,
	// /v1/messages/count_tokens, /v1/responses (+ root /responses). It
	// authenticates with API keys, not the dashboard's JWT, and is registered
	// before the dashboard's authenticated /v1 group so RequireAuth never
	// intercepts it.
	gw := gateway.Register(r, app)

	// Versioned dashboard API. Auth endpoints are public; everything else
	// requires the Bearer JWT issued by /v1/auth/sign-in.
	v1 := r.Group("/v1")

	publicAuth := v1.Group("/auth")
	publicAuth.Post("/sign-in", h.Auth.SignIn)
	publicAuth.Post("/refresh", h.Auth.Refresh)
	publicAuth.Get("/google/redirect", h.Auth.GoogleRedirect)

	v1.Get("/branding", h.Settings.Branding)

	protected := v1.Group("/", middlewares.RequireAuth(app))

	// Auth
	auth := protected.Group("/auth")
	auth.Get("/me", h.Auth.Me)
	auth.Post("/sign-out", h.Auth.SignOut)
	auth.Post("/totp/setup", h.Auth.TOTPSetup)
	auth.Post("/totp/enable", h.Auth.TOTPEnable)
	auth.Post("/totp/disable", h.Auth.TOTPDisable)

	// IP blocklist
	ipBlocks := protected.Group("/ip-blocks")
	ipBlocks.Get("", h.IPBlocks.Index)
	ipBlocks.Post("", h.IPBlocks.Store)
	ipBlocks.Delete("/:id", h.IPBlocks.Delete)

	// Restricted access: allowlist-only period (everything but /health)
	restricted := protected.Group("/restricted-access")
	restricted.Get("", h.Restricted.Get)
	restricted.Put("", h.Restricted.Update)

	// Keys & plans
	keys := protected.Group("/keys")
	keys.Get("", h.Keys.Index)
	keys.Post("", h.Keys.Store)
	keys.Get("/:id", h.Keys.Get)
	keys.Patch("/:id", h.Keys.Update)
	keys.Post("/:id/reveal", h.Keys.Reveal)
	keys.Post("/:id/rotate", h.Keys.Rotate)
	keys.Delete("/:id", h.Keys.Delete)

	plans := protected.Group("/plans")
	plans.Get("", h.Plans.Index)
	plans.Post("", h.Plans.Store)
	plans.Patch("/:id", h.Plans.Update)
	plans.Delete("/:id", h.Plans.Delete)

	// Playground: dashboard chat routed through the gateway, so provider
	// models, aliases, and chains all resolve as they do for clients.
	playground := protected.Group("/playground")
	playground.Get("/models", gw.PlaygroundModels)
	playground.Post("/chat", gw.PlaygroundChat)

	// Routing
	chains := protected.Group("/chains")
	chains.Get("", h.Chains.Index)
	chains.Post("", h.Chains.Store)
	chains.Get("/:id", h.Chains.Get)
	chains.Put("/:id", h.Chains.Update)
	chains.Delete("/:id", h.Chains.Delete)

	aliases := protected.Group("/models/alias")
	aliases.Get("", h.Chains.AliasIndex)
	aliases.Put("", h.Chains.AliasPut)
	aliases.Delete("/:name", h.Chains.AliasDelete)

	// Providers & accounts
	customProviders := protected.Group("/custom-providers")
	customProviders.Get("", h.Providers.CustomIndex)
	customProviders.Post("", h.Providers.CustomStore)
	customProviders.Post("/bulk-delete", h.Providers.CustomBulkDelete)
	customProviders.Get("/by-slug/:slug", h.Providers.CustomShowBySlug)
	customProviders.Get("/:id", h.Providers.CustomShow)
	customProviders.Patch("/:id", h.Providers.CustomUpdate)
	customProviders.Delete("/:id", h.Providers.CustomDelete)
	customProviders.Get("/:id/models", h.Providers.CustomModels)
	customProviders.Post("/:id/models/sync", h.Providers.CustomModelsSync)
	customProviders.Patch("/:id/models", h.Providers.CustomModelsUpdate)
	customProviders.Post("/:id/models/test", h.Providers.CustomModelTest)

	providers := protected.Group("/providers")
	providers.Get("", h.Providers.Index)
	// Catalog provider model catalog + sync (openrouter, ollama, ollama-local,
	// cline): provider slug as :id.
	providers.Get("/:id/models", h.Providers.CatalogModels)
	providers.Post("/:id/models/sync", h.Providers.ModelsSync)
	providers.Patch("/:id/models", h.Providers.CatalogModelsUpdate)
	providers.Post("/:id/models/test", h.Providers.CatalogModelTest)
	// Account strategy per provider (any provider slug as :id): router default,
	// fill first, round robin, or smart round robin.
	providers.Get("/:id/routing", h.Providers.Routing)
	providers.Put("/:id/routing", h.Providers.RoutingUpdate)

	accounts := protected.Group("/accounts")
	accounts.Get("", h.Accounts.Index)
	accounts.Post("", h.Accounts.Store)
	accounts.Get("/:id", h.Accounts.Get)
	accounts.Patch("/:id", h.Accounts.Update)
	accounts.Delete("/:id", h.Accounts.Delete)
	accounts.Post("/:id/test", h.Accounts.Test)
	accounts.Get("/:id/quota", h.Accounts.Quota)

	// OAuth connection flows (anthropic, codex): start a PKCE flow against
	// the provider's official web, then exchange the returned code for sealed
	// tokens. Codex additionally captures its fixed loopback redirect on
	// localhost:1455/1457 via an in-process listener.
	oauthFlows := protected.Group("/oauth/:provider")
	oauthFlows.Post("/authorize", h.OAuth.Authorize)
	oauthFlows.Post("/exchange", h.OAuth.Exchange)

	// Budgets & usage
	budgets := protected.Group("/budgets")
	budgets.Get("", h.Budgets.Index)
	budgets.Get("/status", h.Budgets.Status)
	budgets.Post("", h.Budgets.Store)
	budgets.Put("/:id", h.Budgets.Update)
	budgets.Patch("/:id", h.Budgets.Update)
	budgets.Delete("/:id", h.Budgets.Delete)

	usage := protected.Group("/usage")
	usage.Get("/telemetry", h.Usage.Telemetry)
	usage.Get("/activity", h.Usage.Activity)

	// Quota dashboard
	quota := protected.Group("/quota")
	quota.Get("", h.Quota.Index)
	quota.Get("/overview", h.Quota.Overview)
	quota.Patch("/:id", h.Quota.Update)
	quota.Delete("/:id", h.Quota.Delete)

	// Provider health (derived from gateway attempt outcomes)
	protected.Get("/provider-health", h.ProviderHealth.Overview)

	// Proxy pools
	proxyPools := protected.Group("/proxy-pools")
	proxyPools.Get("", h.ProxyPools.Index)
	proxyPools.Post("", h.ProxyPools.Store)
	proxyPools.Post("/health-check", h.ProxyPools.HealthCheck)
	proxyPools.Post("/bulk", h.ProxyPools.BulkStore)
	proxyPools.Post("/bulk-delete", h.ProxyPools.BulkDelete)
	proxyPools.Post("/relay-script", h.ProxyPools.RelayScript)
	proxyPools.Patch("/:id", h.ProxyPools.Update)
	proxyPools.Delete("/:id", h.ProxyPools.Delete)
	proxyPools.Post("/:id/test", h.ProxyPools.Test)

	// Overrides
	pricing := protected.Group("/model-pricing-overrides")
	pricing.Get("", h.Priming.PricingIndex)
	pricing.Post("", h.Priming.PricingUpsert)
	pricing.Delete("", h.Priming.PricingDelete)

	capabilities := protected.Group("/capability-overrides")
	capabilities.Get("", h.Priming.CapabilityIndex)
	capabilities.Put("", h.Priming.CapabilityPut)
	capabilities.Delete("/:provider/:model", h.Priming.CapabilityDelete)
	capabilities.Post("/reset", h.Priming.CapabilityReset)

	// Guardrails (content-safety policies, layered global → provider →
	// model → chain → key; most specific wins)
	guardrails := protected.Group("/guardrails")
	guardrails.Get("", h.Guardrails.Overview)
	guardrails.Post("", h.Guardrails.Store)
	guardrails.Put("/settings", h.Guardrails.UpdateSettings)
	guardrails.Post("/evaluate", h.Guardrails.Evaluate)
	guardrails.Patch("/:id", h.Guardrails.Update)
	guardrails.Delete("/:id", h.Guardrails.Delete)

	// Settings, skills, console, system, media, CLI tools
	settings := protected.Group("/settings")
	settings.Get("", h.Settings.Get)
	settings.Patch("", h.Settings.Update)

	// Backup & migration: JSON configuration backup (optionally passphrase
	// portable), raw SQLite snapshot/restore, and 9router/OmniRoute imports.
	backup := protected.Group("/backup")
	backup.Post("/config/export", h.Backup.ConfigExport)
	backup.Post("/config/import", h.Backup.ConfigImport)
	backup.Get("/database", h.Backup.DatabaseInfo)
	backup.Post("/database/download", h.Backup.DatabaseDownload)
	backup.Post("/database/restore", h.Backup.DatabaseRestore)
	protected.Post("/import/:source", h.LegacyImport.Import)

	skills := protected.Group("/skills")
	skills.Get("", h.Skills.Index)
	skills.Post("", h.Skills.Store)
	skills.Patch("/:id", h.Skills.Update)
	skills.Delete("/:id", h.Skills.Delete)

	console := protected.Group("/console")
	console.Get("", h.Console.Index)
	console.Delete("", h.Console.Clear)

	protected.Get("/system/stats", h.System.Stats)

	protected.Get("/media", h.Media.Index)

	claudeCode := protected.Group("/cli-tools/claude-code")
	claudeCode.Get("", h.CliTools.ClaudeCode)
	claudeCode.Post("/apply", h.CliTools.ClaudeCodeApply)

	// Tunnels (cloudflared quick tunnel exposing this server publicly)
	tunnels := protected.Group("/tunnels")
	tunnels.Get("/cloudflare", h.Tunnels.Cloudflare)
	tunnels.Post("/cloudflare/enable", h.Tunnels.CloudflareEnable)
	tunnels.Post("/cloudflare/disable", h.Tunnels.CloudflareDisable)
	// Tailscale (tailscale serve exposing this server on the host's tailnet)
	tunnels.Get("/tailscale", h.Tunnels.Tailscale)
	tunnels.Post("/tailscale/enable", h.Tunnels.TailscaleEnable)
	tunnels.Post("/tailscale/disable", h.Tunnels.TailscaleDisable)

	return gw
}
