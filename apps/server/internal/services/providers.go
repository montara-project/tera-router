package services

import (
	"context"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

type ProviderService struct {
	repos *repositories.Repositories
	audit *AuditService
}

// ProviderView matches the web UI Provider model: id, name, slug, connected,
// accounts, capabilities, official.
type ProviderView struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Slug         string   `json:"slug"`
	Connected    bool     `json:"connected"`
	Accounts     int      `json:"accounts,omitempty"`
	Capabilities []string `json:"capabilities"`
	Official     bool     `json:"official,omitempty"`
	Notice       string   `json:"notice,omitempty"`
}

// ProvidersOverview is the GET /v1/providers payload: which providers are
// connected (have accounts or a custom provider) and which are available.
type ProvidersOverview struct {
	Connected []ProviderView `json:"connected"`
	Available []ProviderView `json:"available"`
}

// Overview aggregates catalog providers with live account counts.
func (s *ProviderService) Overview(ctx context.Context) (ProvidersOverview, error) {
	counts, err := s.repos.Accounts.CountByProvider(ctx)
	if err != nil {
		return ProvidersOverview{}, err
	}
	customs, err := s.repos.Providers.List(ctx)
	if err != nil {
		return ProvidersOverview{}, err
	}
	customSlugs := map[string]bool{}
	for _, c := range customs {
		customSlugs[c.Slug] = true
	}

	overview := ProvidersOverview{
		Connected: []ProviderView{},
		Available: []ProviderView{},
	}

	for _, spec := range Catalog() {
		accounts := counts[spec.Slug]
		connected := accounts > 0 || customSlugs[spec.Slug]
		view := ProviderView{
			ID:           "prov-" + spec.Slug,
			Name:         spec.Name,
			Slug:         spec.Slug,
			Connected:    connected,
			Accounts:     accounts,
			Capabilities: spec.Capabilities,
			Official:     spec.Official,
			Notice:       spec.Notice,
		}
		if connected {
			overview.Connected = append(overview.Connected, view)
			continue
		}
		overview.Available = append(overview.Available, view)
	}

	// Custom providers with a slug outside the catalog render as their own
	// connected entries; catalog slugs are already covered above.
	for _, c := range customs {
		if isCatalogSlug(c.Slug) {
			continue
		}
		overview.Connected = append(overview.Connected, ProviderView{
			ID:           c.ID,
			Name:         c.Name,
			Slug:         c.Slug,
			Connected:    true,
			Accounts:     counts[c.Slug],
			Capabilities: []string{"chat"},
			Official:     true,
		})
	}
	return overview, nil
}

func isCatalogSlug(slug string) bool {
	_, ok := CatalogLookup(slug)
	return ok
}

// Rates returns the per-provider pricing snapshot. Overrides arrive from the
// pricing-overrides endpoints; the static catalog has no per-model rates.
func (s *ProviderService) Rates(ctx context.Context) (map[string]any, error) {
	overrides, err := s.repos.Pricing.List(ctx, "")
	if err != nil {
		return nil, err
	}
	return map[string]any{"overrides": overrides}, nil
}

// CreateCustomProvider registers an OpenAI-compatible upstream.
func (s *ProviderService) CreateCustomProvider(ctx context.Context, actor string, p models.CustomProvider) (models.CustomProvider, error) {
	p.ID = uuid.NewString()
	if err := s.repos.Providers.Create(ctx, p); err != nil {
		return models.CustomProvider{}, err
	}
	s.audit.Record(ctx, actor, "custom_provider.create", p.ID, map[string]string{"slug": p.Slug})
	return p, nil
}

func (s *ProviderService) CustomProviders(ctx context.Context) ([]models.CustomProvider, error) {
	return s.repos.Providers.List(ctx)
}

func (s *ProviderService) UpdateCustomProvider(ctx context.Context, actor string, p models.CustomProvider) (models.CustomProvider, error) {
	if err := s.repos.Providers.Update(ctx, p); err != nil {
		return models.CustomProvider{}, err
	}
	s.audit.Record(ctx, actor, "custom_provider.update", p.ID, nil)
	return s.repos.Providers.FindByID(ctx, p.ID)
}

func (s *ProviderService) DeleteCustomProvider(ctx context.Context, actor, id string) error {
	if err := s.repos.Providers.Delete(ctx, id); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "custom_provider.delete", id, nil)
	return nil
}
