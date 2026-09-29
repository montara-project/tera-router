package handlers

import (
	"context"
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

type quotaHandler struct {
	app *app.Application
}

// QuotaAccount is one row of the quota page. Field names match the web UI
// QuotaAccount model.
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

// quotaSummary totals the account list for the header cards. Field names
// match the web UI QuotaSummary model.
type quotaSummary struct {
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

func (h *quotaHandler) quotaRows(ctx context.Context, rng string) ([]QuotaAccount, error) {
	accounts, _, err := h.app.Repos.Accounts.List(ctx, 0, 100)
	if err != nil {
		return nil, err
	}
	usage, err := h.app.Repos.Usage.ByAccount(ctx, rangeStart(rng))
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
			AuthLabel:       a.Provider + " · " + orDefault(string(a.AuthKind), "api_key"),
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

// Index lists every account as a quota row.
func (h *quotaHandler) Index(c fiber.Ctx) error {
	rows, err := h.quotaRows(c.Context(), c.Query("range", "30d"))
	if err != nil {
		return err
	}
	return dtos.List(c, rows, dtos.TotalMeta(len(rows)))
}

// Overview returns the summary header plus rows (?range=today|7d|30d).
func (h *quotaHandler) Overview(c fiber.Ctx) error {
	rng := c.Query("range", "30d")
	accounts, err := h.quotaRows(c.Context(), rng)
	if err != nil {
		return err
	}

	summary := quotaSummary{TotalAccounts: len(accounts)}
	for _, a := range accounts {
		summary.Requests += a.Requests
		summary.InputTokens += a.InputTokens
		summary.OutputTokens += a.OutputTokens
		summary.AttributedCost += a.AttributedCost
		if a.Status == "paused" {
			summary.Paused++
		} else {
			summary.ActiveAccounts++
		}
		summary.UsageOnly++
	}

	return dtos.OK(c, fiber.Map{"summary": summary, "accounts": accounts})
}

// Update toggles an account's enabled state (active ↔ paused).
func (h *quotaHandler) Update(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	account, err := h.app.Repos.Accounts.Get(c.Context(), id.String())
	if err != nil {
		return err
	}

	disabled := !account.Disabled
	account.Disabled = disabled
	if err := h.app.Repos.Accounts.SetDisabled(c.Context(), id.String(), disabled); err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"id": id.String()})
}

// Delete removes the account from the quota page.
func (h *quotaHandler) Delete(c fiber.Ctx) error {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return apperr.ErrBadRequest
	}

	if err := h.app.Repos.Accounts.Delete(c.Context(), id.String()); err != nil {
		return err
	}
	auditRecord(c.Context(), h.app, actorFrom(c), "account.delete", id.String(), nil)
	return dtos.OK(c, fiber.Map{"id": id.String()})
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
