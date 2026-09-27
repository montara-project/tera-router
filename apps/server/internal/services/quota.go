package services

import (
	"context"
	"strings"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// QuotaService builds the account quota snapshot the dashboard renders:
// per-account request/token/cost rollups styled like the web mock.
type QuotaService struct {
	repos *repositories.Repositories
}

// QuotaAccount is one row of the quota page.
type QuotaAccount struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Provider        string  `json:"provider"`
	AuthLabel       string  `json:"auth_label"`
	Initials        string  `json:"initials"`
	Status          string  `json:"status"`
	Priority        int     `json:"priority"`
	QuotaVisibility string  `json:"quota_visibility"`
	QuotaNote       string  `json:"quota_note"`
	Requests        int64   `json:"requests"`
	InputTokens     int64   `json:"input_tokens"`
	OutputTokens    int64   `json:"output_tokens"`
	AttributedCost  float64 `json:"attributed_cost"`
	Attention       bool    `json:"attention"`
	Depleted        bool    `json:"depleted"`
}

// QuotaSummary totals the account list for the header cards.
type QuotaSummary struct {
	TotalAccounts     int     `json:"total_accounts"`
	ActiveAccounts    int     `json:"active_accounts"`
	Paused            int     `json:"paused"`
	Attention         int     `json:"attention"`
	Depleted          int     `json:"depleted"`
	Requests          int64   `json:"requests"`
	InputTokens       int64   `json:"input_tokens"`
	OutputTokens      int64   `json:"output_tokens"`
	AttributedCost    float64 `json:"attributed_cost"`
	AccountsReporting int     `json:"accounts_reporting"`
	QuotaCapable      int     `json:"quota_capable"`
	UsageOnly         int     `json:"usage_only"`
	NotReported       int     `json:"not_reported"`
}

// List returns every account as a quota row over the requested range.
func (s *QuotaService) List(ctx context.Context, rng string) ([]QuotaAccount, error) {
	accounts, _, err := s.repos.Accounts.List(ctx, 0, 100)
	if err != nil {
		return nil, err
	}
	usage, err := s.repos.Usage.ByAccount(ctx, rangeStart(rng))
	if err != nil {
		return nil, err
	}

	usageByAccount := map[string]repositories.UsageByAccount{}
	for _, u := range usage {
		usageByAccount[u.AccountID] = u
	}

	out := make([]QuotaAccount, 0, len(accounts))
	for _, a := range accounts {
		u := usageByAccount[a.ID]
		status := "active"
		if a.Disabled {
			status = "paused"
		}
		out = append(out, QuotaAccount{
			ID:              a.ID,
			Name:            a.Label,
			Provider:        a.Provider,
			AuthLabel:       accountAuthLabel(a),
			Initials:        initialsOf(a.Label, a.Provider),
			Status:          status,
			Priority:        a.Priority,
			QuotaVisibility: "usage-only",
			QuotaNote:       "Provider does not expose upstream limits.",
			Requests:        u.Requests,
			InputTokens:     u.InputTokens,
			OutputTokens:    u.OutputTokens,
			AttributedCost:  float64(u.CostMicros) / 1_000_000,
		})
	}
	return out, nil
}

// Overview returns the summary plus rows for one range.
func (s *QuotaService) Overview(ctx context.Context, rng string) (QuotaSummary, []QuotaAccount, error) {
	accounts, err := s.List(ctx, rng)
	if err != nil {
		return QuotaSummary{}, nil, err
	}

	summary := QuotaSummary{TotalAccounts: len(accounts)}
	for _, a := range accounts {
		summary.Requests += a.Requests
		summary.InputTokens += a.InputTokens
		summary.OutputTokens += a.OutputTokens
		summary.AttributedCost += a.AttributedCost
		switch a.Status {
		case "paused":
			summary.Paused++
		default:
			summary.ActiveAccounts++
		}
		if a.Attention {
			summary.Attention++
		}
		if a.Depleted {
			summary.Depleted++
		}
		summary.UsageOnly++
	}
	return summary, accounts, nil
}

func accountAuthLabel(a models.Account) string {
	kind := string(a.AuthKind)
	if kind == "" {
		kind = "api_key"
	}
	return a.Provider + " · " + kind
}

// initialsOf renders the two-letter avatar hint from the label.
func initialsOf(label, provider string) string {
	source := strings.TrimSpace(label)
	if source == "" {
		source = provider
	}
	runes := []rune(strings.ToUpper(source))
	if len(runes) >= 2 {
		return string(runes[:2])
	}
	if len(runes) == 1 {
		return string(runes)
	}
	return "??"
}
