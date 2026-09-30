package handlers

import "tera-router/server/internal/app"

// Handlers aggregates every handler group for route registration.
type Handlers struct {
	Health     *healthHandler
	Auth       *authHandler
	Keys       *keysHandler
	Plans      *plansHandler
	Chains     *chainsHandler
	Accounts   *accountsHandler
	Providers  *providersHandler
	Budgets    *budgetsHandler
	Usage      *usageHandler
	Quota      *quotaHandler
	ProxyPools *proxyPoolsHandler
	Settings   *settingsHandler
	Skills     *skillsHandler
	Priming    *pricingHandler
	Guardrails *guardrailsHandler
	Console    *consoleHandler
	System     *systemHandler
	Media      *mediaHandler
}

// New builds every handler group on top of the shared application container.
func New(app *app.Application) *Handlers {
	return &Handlers{
		Health:     &healthHandler{app: app},
		Auth:       &authHandler{app: app},
		Keys:       &keysHandler{app: app},
		Plans:      &plansHandler{app: app},
		Chains:     &chainsHandler{app: app},
		Accounts:   &accountsHandler{app: app},
		Providers:  &providersHandler{app: app},
		Budgets:    &budgetsHandler{app: app},
		Usage:      &usageHandler{app: app},
		Quota:      &quotaHandler{app: app},
		ProxyPools: &proxyPoolsHandler{app: app},
		Settings:   &settingsHandler{app: app},
		Skills:     &skillsHandler{app: app},
		Priming:    &pricingHandler{app: app},
		Guardrails: &guardrailsHandler{app: app},
		Console:    &consoleHandler{app: app},
		System:     &systemHandler{app: app},
		Media:      &mediaHandler{app: app},
	}
}
