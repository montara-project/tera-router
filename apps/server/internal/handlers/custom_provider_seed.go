package handlers

import (
	"cmp"
	"context"
	"errors"

	"tera-router/server/internal/app"
	"tera-router/server/internal/catalog"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/google/uuid"
)

// ensureCustomProviderRow materializes the custom_providers row of a seedable
// catalog provider, seeded from the catalog spec (name, endpoint, wire
// dialect), so a connected provider is always addressable by uuid through the
// custom-provider endpoints. An existing row wins — the operator may have
// edited it. Returns the inserted row, or nil when nothing was created
// (not seedable, already present, or not in the catalog).
func ensureCustomProviderRow(ctx context.Context, a *app.Application, actor, slug string) (*models.CustomProvider, error) {
	if !catalog.Seedable(slug) {
		return nil, nil
	}
	if _, err := a.Repos.Providers.GetBySlug(ctx, slug); err == nil {
		return nil, nil
	} else if !errors.Is(err, apperr.ErrNotFound) {
		return nil, err
	}

	spec, ok := catalog.Lookup(slug)
	if !ok {
		return nil, nil
	}
	row := models.CustomProvider{
		ID:       uuid.NewString(),
		Name:     spec.Name,
		Slug:     spec.Slug,
		BaseURL:  spec.BaseURL,
		APIKind:  cmp.Or(spec.Dialect, "openai"),
		Pricing:  "{}",
		Metadata: "{}",
		Enabled:  true,
	}
	if err := a.Repos.Providers.Insert(ctx, row); err != nil {
		// A concurrent connect may have inserted the row between the lookup
		// and the insert; the row existing is the goal, not this insert.
		if _, recheck := a.Repos.Providers.GetBySlug(ctx, slug); recheck == nil {
			return nil, nil
		}
		return nil, err
	}
	auditRecord(ctx, a, actor, "custom_provider.create", row.ID,
		map[string]string{"slug": slug, "seeded_from": "catalog"})
	return &row, nil
}
