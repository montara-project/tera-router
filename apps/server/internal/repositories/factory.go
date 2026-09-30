// Package repositories holds the hand-written SQL data access layer. Each
// repository owns the queries for one aggregate and returns
// apperr.ErrNotFound when a row lookup misses.
//
// Every repository follows the same shape: an exported method on the pooled
// connection and a private *Exec method taking an Executor, so the identical
// SQL can also run inside a transaction:
//
//	List/listExec, Get/getExec, Insert/insertExec, Update/updateExec,
//	Delete/deleteExec
//
// Not every family exists on every repository — Count, for instance, is only
// present as the targeted CountByProvider/CountByPlan reads.
//
// Statements in this package never reach the driver directly; they go through
// the BaseRepository helpers, which log every query when debug mode is on.
// Seeder and migrator SQL lives outside this package and does not.
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

// New builds every repository on top of the shared connection pool, handing
// each one the app config so debug query logging follows --debug.
func New(db *sql.DB, cfg *config.ConfigApp) *Repositories {
	base := BaseRepository{DB: db, Config: cfg}

	return &Repositories{
		DB:         db,
		Users:      &UserRepository{base},
		Refresh:    &RefreshTokenRepository{base},
		APIKeys:    &APIKeyRepository{base},
		Plans:      &PlanRepository{base},
		Chains:     &ChainRepository{base},
		Aliases:    &AliasRepository{base},
		Providers:  &ProviderRepository{base},
		Accounts:   &AccountRepository{base},
		Budgets:    &BudgetRepository{base},
		Usage:      &UsageRepository{base},
		ProxyPools: &ProxyPoolRepository{base},
		Skills:     &SkillRepository{base},
		Settings:   &SettingRepository{base},
		Audit:      &AuditRepository{base},
		Guardrails: &GuardrailRepository{base},
		Pricing:    &PricingRepository{base},
		Capability: &CapabilityRepository{base},
	}
}
