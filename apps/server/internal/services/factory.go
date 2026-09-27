// Package services holds the business logic between handlers and
// repositories. Each service owns one dashboard domain, mirroring the IDRouter
// admin API surface.
package services

import (
	"log/slog"

	"tera-router/server/internal/config"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/repositories"
)

// Services aggregates every service for injection into handlers.
type Services struct {
	Secrets    *sealer.Sealer
	Auth       *AuthService
	Keys       *KeyService
	Plans      *PlanService
	Chains     *ChainService
	Accounts   *AccountService
	Providers  *ProviderService
	Budgets    *BudgetService
	Usage      *UsageService
	Quota      *QuotaService
	ProxyPools *ProxyPoolService
	Settings   *SettingsService
	Skills     *SkillService
	Priming    *PricingService
	Media      *MediaService
	Console    *ConsoleService
	System     *SystemService
	Audit      *AuditService
}

// New wires every service on top of the repositories and shared crypto.
func New(repos *repositories.Repositories, cfg *config.Config, logger *slog.Logger) (*Services, error) {
	secrets, err := sealer.FromSecret(cfg.App.Secret)
	if err != nil {
		return nil, err
	}

	console := NewConsoleService()
	audit := NewAuditService(repos.Audit, console)

	return &Services{
		Secrets: secrets,
		Auth: &AuthService{
			repos:   repos,
			secrets: secrets,
			cfg:     cfg,
		},
		Keys: &KeyService{
			repos:   repos,
			secrets: secrets,
			audit:   audit,
		},
		Plans: &PlanService{
			repos: repos,
			audit: audit,
		},
		Chains: &ChainService{
			repos: repos,
			audit: audit,
		},
		Accounts: &AccountService{
			repos:   repos,
			secrets: secrets,
			audit:   audit,
		},
		Providers: &ProviderService{
			repos: repos,
			audit: audit,
		},
		Budgets: &BudgetService{
			repos: repos,
			audit: audit,
		},
		Usage: &UsageService{repos: repos},
		Quota: &QuotaService{repos: repos},
		ProxyPools: &ProxyPoolService{
			repos: repos,
			audit: audit,
		},
		Settings: &SettingsService{repos: repos, audit: audit},
		Skills:   &SkillService{repos: repos, audit: audit},
		Priming:  &PricingService{repos: repos, audit: audit},
		Media:    &MediaService{},
		Console:  console,
		System:   NewSystemService(),
		Audit:    audit,
	}, nil
}
