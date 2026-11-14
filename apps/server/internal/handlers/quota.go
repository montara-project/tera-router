package handlers

import (
	"context"
	"slices"
	"sort"
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

type quotaHandler struct {
	app *app.Application
}

// quotaScanLimit bounds the accounts one quota request reads. The rows are
// joined with usage and filtered here, so every account is read at once.
//
// ponytail: one unpaged scan. Move the join and the filters into SQL when an
// install holds more accounts than this.
const quotaScanLimit = 10000

// quotaRows builds one quota row per account, with its usage over the range.
func (h *quotaHandler) quotaRows(ctx context.Context, rng string) ([]dtos.QuotaAccount, error) {
	accounts, _, err := h.app.Repos.Accounts.List(ctx, repositories.AccountFilter{}, 0, quotaScanLimit)
	if err != nil {
		return nil, err
	}
	usage, err := h.app.Repos.Usage.ByAccount(ctx, rangeStart(rng))
	if err != nil {
		return nil, err
	}

	names, _, _, err := (&usageHandler{app: h.app}).providerMeta(ctx)
	if err != nil {
		return nil, err
	}

	usageByAccount := map[string]repositories.UsageByAccount{}
	for _, u := range usage {
		usageByAccount[u.AccountID] = u
	}

	out := make([]dtos.QuotaAccount, 0, len(accounts))
	for _, a := range accounts {
		u := usageByAccount[a.ID]
		status := "active"
		if a.Disabled {
			status = "paused"
		}
		out = append(out, dtos.QuotaAccount{
			ID:              a.ID,
			Name:            a.Label,
			Provider:        a.Provider,
			AuthLabel:       providerDisplayName(names, a.Provider) + " · " + authKindLabel(a.AuthKind),
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

// authKindLabel is the readable name of how an account signs in upstream.
func authKindLabel(kind models.AuthKind) string {
	switch kind {
	case models.AuthOAuth:
		return "OAuth"
	case models.AuthNone:
		return "No auth"
	default:
		return "API key"
	}
}

// Index lists accounts as quota rows, one page at a time. `search` matches the
// provider or the account name; `provider`, `status` (active, paused,
// attention) and `quota_state` narrow the rows; `sort` orders them (attention
// first by default, or name, requests, cost). The total counts the rows that
// match, before paging.
func (h *quotaHandler) Index(c fiber.Ctx) error {
	q, err := listPage(c)
	if err != nil {
		return err
	}
	rows, err := h.quotaRows(c.Context(), c.Query("range", "30d"))
	if err != nil {
		return err
	}

	search := listSearch(c)
	provider, status, state := c.Query("provider"), c.Query("status"), c.Query("quota_state")
	rows = keep(rows, func(a dtos.QuotaAccount) bool {
		if provider != "" && a.Provider != provider {
			return false
		}
		switch status {
		case "attention":
			if !a.Attention {
				return false
			}
		case "active", "paused":
			if a.Status != status {
				return false
			}
		}
		if state != "" && a.QuotaVisibility != state {
			return false
		}
		return matchesSearch(search, a.Provider+" "+a.Name)
	})

	// Stable sorts: rows that tie keep the newest-first order of the scan.
	switch c.Query("sort") {
	case "name":
		sort.SliceStable(rows, func(i, j int) bool {
			return strings.ToLower(rows[i].Name) < strings.ToLower(rows[j].Name)
		})
	case "requests":
		sort.SliceStable(rows, func(i, j int) bool { return rows[i].Requests > rows[j].Requests })
	case "cost":
		sort.SliceStable(rows, func(i, j int) bool { return rows[i].AttributedCost > rows[j].AttributedCost })
	default:
		sort.SliceStable(rows, func(i, j int) bool { return rows[i].Attention && !rows[j].Attention })
	}

	return dtos.List(c, pageOf(rows, q.Offset, q.Limit), dtos.ListMeta(len(rows), q.Offset, q.Limit))
}

// Overview returns the summary header (?range=today|7d|30d): the totals, the
// counts behind the status chips, and the providers that have accounts. The
// rows themselves come from Index, a page at a time.
func (h *quotaHandler) Overview(c fiber.Ctx) error {
	rng := c.Query("range", "30d")
	accounts, err := h.quotaRows(c.Context(), rng)
	if err != nil {
		return err
	}

	summary := dtos.QuotaSummary{TotalAccounts: len(accounts), Providers: []string{}}
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
		if a.Attention {
			summary.Attention++
		}
		if a.Depleted {
			summary.Depleted++
		}
		if a.Attention && !a.Depleted && a.QuotaVisibility == "quota-capable" {
			summary.NearLimit++
		}
		if !slices.Contains(summary.Providers, a.Provider) {
			summary.Providers = append(summary.Providers, a.Provider)
		}
	}
	slices.Sort(summary.Providers)

	return dtos.OK(c, fiber.Map{"summary": summary})
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
	auditRecord(c, actorFrom(c), "account.delete", id.String(), nil)
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
