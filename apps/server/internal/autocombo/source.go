package autocombo

import (
	"context"
	"time"

	"tera-router/server/internal/modelcatalog"
	"tera-router/server/internal/repositories"
)

// accountScanLimit caps how many account rows one build reads. The engine
// only needs provider names and two flags, so even a large deployment stays
// far below this.
const accountScanLimit = 10000

// RepoAccounts adapts the account repository to the AccountSource interface.
type RepoAccounts struct {
	R *repositories.AccountRepository
}

// ListAll returns every registered account as engine refs.
func (s RepoAccounts) ListAll(ctx context.Context) ([]AccountRef, error) {
	rows, _, err := s.R.List(ctx, 0, accountScanLimit)
	if err != nil {
		return nil, err
	}
	out := make([]AccountRef, 0, len(rows))
	for _, acc := range rows {
		out = append(out, AccountRef{
			Provider:       acc.Provider,
			Disabled:       acc.Disabled,
			NeedsReconnect: acc.NeedsReconnect,
		})
	}
	return out, nil
}

// RepoStats adapts the usage repository to the StatsSource interface.
type RepoStats struct {
	R *repositories.UsageRepository
}

// ModelStats returns the per provider/model outcome aggregates since from.
func (s RepoStats) ModelStats(ctx context.Context, from time.Time) ([]PairStats, error) {
	groups, err := s.R.ByModelGrouped(ctx, from)
	if err != nil {
		return nil, err
	}
	out := make([]PairStats, 0, len(groups))
	for _, g := range groups {
		out = append(out, PairStats{
			Provider:     g.Provider,
			Model:        g.Model,
			Requests:     g.Requests,
			Failures:     g.Failed,
			AvgLatencyMS: g.AvgLatencyMS,
		})
	}
	return out, nil
}

// RepoCatalog adapts the settings repository (the stored model catalogs) to
// the CatalogSource interface.
type RepoCatalog struct {
	R *repositories.SettingRepository
}

// ActiveModels returns the ids a provider's stored catalog marks active, or
// hasCatalog=false when it has none.
func (s RepoCatalog) ActiveModels(ctx context.Context, provider string) (map[string]bool, bool, error) {
	return modelcatalog.ActiveModels(ctx, s.R, provider)
}
