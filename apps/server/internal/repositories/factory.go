// Package repositories holds the hand-written SQL data access layer. Each
// repository owns the queries for one aggregate and returns
// apperr.ErrNotFound when a row lookup misses.
package repositories

import (
	"database/sql"

	"tera-router/server/internal/config"
)

// Repositories aggregates every repository for injection into services.
type Repositories struct {
	DB         *sql.DB
	Users      *UserRepository
	Refresh    *RefreshTokenRepository
	APIKeys    *APIKeyRepository
	Plans      *PlanRepository
	Chains     *ChainRepository
	Aliases    *AliasRepository
	Providers  *ProviderRepository
	Accounts   *AccountRepository
	Budgets    *BudgetRepository
	Usage      *UsageRepository
	ProxyPools *ProxyPoolRepository
	Skills     *SkillRepository
	Settings   *SettingRepository
	Audit      *AuditRepository
	Guardrails *GuardrailRepository
	Pricing    *PricingRepository
	Capability *CapabilityRepository
}

// New builds every repository on top of the shared connection pool.
func New(db *sql.DB, _ *config.ConfigApp) *Repositories {
	return &Repositories{
		DB:         db,
		Users:      &UserRepository{db},
		Refresh:    &RefreshTokenRepository{db},
		APIKeys:    &APIKeyRepository{db},
		Plans:      &PlanRepository{db},
		Chains:     &ChainRepository{db},
		Aliases:    &AliasRepository{db},
		Providers:  &ProviderRepository{db},
		Accounts:   &AccountRepository{db},
		Budgets:    &BudgetRepository{db},
		Usage:      &UsageRepository{db},
		ProxyPools: &ProxyPoolRepository{db},
		Skills:     &SkillRepository{db},
		Settings:   &SettingRepository{db},
		Audit:      &AuditRepository{db},
		Guardrails: &GuardrailRepository{db},
		Pricing:    &PricingRepository{db},
		Capability: &CapabilityRepository{db},
	}
}
