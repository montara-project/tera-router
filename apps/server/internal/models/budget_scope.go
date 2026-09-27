package models

// BudgetScope identifies what a budget applies to.
type BudgetScope string

const (
	ScopeTenant  BudgetScope = "tenant"
	ScopeAPIKey  BudgetScope = "api_key"
	ScopeAccount BudgetScope = "account"
)
