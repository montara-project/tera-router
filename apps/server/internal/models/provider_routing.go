package models

// Account strategies decide which of a provider's accounts serves a request.
const (
	// AccountStrategyDefault follows the global Settings › Routing switch.
	AccountStrategyDefault = "default"
	// AccountStrategyFillFirst uses the top healthy account (by priority)
	// until it is unavailable.
	AccountStrategyFillFirst = "fill-first"
	// AccountStrategyRoundRobin rotates accounts every StickyLimit requests.
	AccountStrategyRoundRobin = "round-robin"
	// AccountStrategySmartRoundRobin rotates accounts across new sessions
	// (every StickyLimit of them) and keeps each conversation on the account
	// it started on for AffinityHours.
	AccountStrategySmartRoundRobin = "smart-round-robin"
)

// ProviderRouting is one provider's account strategy, stored as a JSON blob in
// the settings kv table.
type ProviderRouting struct {
	Strategy      string `json:"strategy"`
	StickyLimit   int    `json:"sticky_limit"`
	AffinityHours int    `json:"affinity_hours"`
}

// DefaultProviderRouting is what a provider uses until the operator picks a
// strategy on its detail page.
func DefaultProviderRouting() ProviderRouting {
	return ProviderRouting{Strategy: AccountStrategyDefault, StickyLimit: 3, AffinityHours: 24}
}
