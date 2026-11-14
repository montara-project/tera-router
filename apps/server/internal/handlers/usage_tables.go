package handlers

import (
	"sort"
	"strings"
	"time"

	"tera-router/server/internal/dtos"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

// The Usage page's three tables. Each has its own endpoint so a search, a
// sort or a page change reads only that table, not the whole telemetry
// payload, and so the filtering happens here rather than in the browser.

// Models lists the model accounting rows of the range (?range=, default 30d).
// `provider` keeps one provider's models and `search` matches the model name
// (or the provider slug, when no provider is given). `sort` is model,
// requests, tokens, cost, latency or pricing, descending unless `order=asc`;
// without it the rows keep the order of the aggregate. `limit` and `offset`
// cut a page.
func (h *usageHandler) Models(c fiber.Ctx) error {
	from := rangeStart(c.Query("range", "30d"))
	var (
		byModel   []repositories.UsageGroup
		overrides []models.PricingOverride
		kinds     map[string]string
	)
	err := parallel(
		func() (err error) { byModel, err = h.app.Repos.Usage.ByModelGrouped(c.Context(), from); return },
		func() (err error) { overrides, err = h.app.Repos.Pricing.List(c.Context(), ""); return },
		func() (err error) { _, kinds, _, err = h.providerMeta(c.Context()); return },
	)
	if err != nil {
		return err
	}
	rows := modelRows(byModel, modelRates(overrides, byModel), kinds)

	search, provider := listSearch(c), strings.ToLower(strings.TrimSpace(c.Query("provider")))
	rows = keep(rows, func(r dtos.UsageTelemetryModelRow) bool {
		if provider != "" {
			return strings.ToLower(r.Provider) == provider && matchesSearch(search, r.Model)
		}
		return matchesSearch(search, r.Model, r.Provider)
	})

	if less := modelRowOrder(c.Query("sort")); less != nil {
		desc := c.Query("order") != "asc"
		sort.SliceStable(rows, func(i, j int) bool {
			if desc {
				return less(rows[j], rows[i])
			}
			return less(rows[i], rows[j])
		})
	}
	return respondList(c, rows)
}

// modelRowOrder returns the ascending comparison of a sort key, nil for an
// unknown or missing key.
func modelRowOrder(key string) func(a, b dtos.UsageTelemetryModelRow) bool {
	// An unpriced row sorts below every priced one.
	cost := func(r dtos.UsageTelemetryModelRow) int64 {
		if r.CostMicros == nil {
			return -1
		}
		return *r.CostMicros
	}
	switch key {
	case "model":
		return func(a, b dtos.UsageTelemetryModelRow) bool {
			return strings.ToLower(a.Model) < strings.ToLower(b.Model)
		}
	case "requests":
		return func(a, b dtos.UsageTelemetryModelRow) bool { return a.Requests < b.Requests }
	case "tokens":
		return func(a, b dtos.UsageTelemetryModelRow) bool {
			return a.InputTokens+a.OutputTokens < b.InputTokens+b.OutputTokens
		}
	case "cost":
		return func(a, b dtos.UsageTelemetryModelRow) bool { return cost(a) < cost(b) }
	case "latency":
		return func(a, b dtos.UsageTelemetryModelRow) bool { return a.LatencyMs < b.LatencyMs }
	case "pricing":
		return func(a, b dtos.UsageTelemetryModelRow) bool { return a.Coverage < b.Coverage }
	}
	return nil
}

// Providers lists the provider accounting rows of the range (?range=, default
// 30d), each with its health over the same window. `limit` and `offset` cut a
// page.
func (h *usageHandler) Providers(c fiber.Ctx) error {
	now := time.Now()
	from := rangeStart(c.Query("range", "30d"))
	u := h.app.Repos.Usage
	var (
		byProvider, byModel     []repositories.UsageGroup
		healthRows              []repositories.UsageHealthRow
		overrides               []models.PricingOverride
		names, kinds, detailIDs map[string]string
	)
	err := parallel(
		func() (err error) { byProvider, err = u.ByProvider(c.Context(), from); return },
		func() (err error) { byModel, err = u.ByModelGrouped(c.Context(), from); return },
		func() (err error) { healthRows, err = u.HealthRows(c.Context(), from); return },
		func() (err error) { overrides, err = h.app.Repos.Pricing.List(c.Context(), ""); return },
		func() (err error) { names, kinds, detailIDs, err = h.providerMeta(c.Context()); return },
	)
	if err != nil {
		return err
	}
	derived, priced := costByProvider(byModel, modelRates(overrides, byModel))
	rows := withHealth(
		providerRows(byProvider, derived, priced, names, kinds),
		buildHealthOverview(healthRows, nil, from, now).Providers,
		detailIDs,
	)
	return respondList(c, rows)
}

// Requests lists the request log of the range (?range=, default 30d), newest
// first and one page at a time. `search` matches the model, the API key's
// name, the client, the row id, or the provider by slug or display name;
// `status=failed` keeps the failed attempts. The metadata carries the size of
// the whole window and how much of it failed, for the status chips.
func (h *usageHandler) Requests(c fiber.Ctx) error {
	q, err := listPage(c)
	if err != nil {
		return err
	}
	from := rangeStart(c.Query("range", "30d"))
	u := h.app.Repos.Usage

	var (
		byModel      []repositories.UsageGroup
		overrides    []models.PricingOverride
		names, kinds map[string]string
		all, failed  int
	)
	err = parallel(
		func() (err error) { byModel, err = u.ByModelGrouped(c.Context(), from); return },
		func() (err error) { overrides, err = h.app.Repos.Pricing.List(c.Context(), ""); return },
		func() (err error) { names, kinds, _, err = h.providerMeta(c.Context()); return },
		func() (err error) { all, failed, err = u.RequestCounts(c.Context(), from); return },
	)
	if err != nil {
		return err
	}

	filter := repositories.UsageRequestFilter{
		Search:     strings.TrimSpace(c.Query("search")),
		FailedOnly: c.Query("status") == "failed",
	}
	// The table shows providers by display name, so a search for that name
	// has to reach the rows, which store the slug.
	if search := strings.ToLower(filter.Search); search != "" {
		for slug, name := range names {
			if strings.Contains(strings.ToLower(name), search) {
				filter.Providers = append(filter.Providers, slug)
			}
		}
	}
	records, total, err := u.Requests(c.Context(), from, filter, q.Offset, q.Limit)
	if err != nil {
		return err
	}

	meta := dtos.ListMeta(total, q.Offset, q.Limit)
	meta["total_all"] = all
	meta["total_failed"] = failed
	return dtos.List(c, requestRows(records, modelRates(overrides, byModel), time.Now(), kinds, names), meta)
}
