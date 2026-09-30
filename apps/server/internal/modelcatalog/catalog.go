// Package modelcatalog persists the model list a custom provider's upstream
// advertises, as fetched by the dashboard's "Sync from /models" action
// (POST /v1/custom-providers/:id/models/sync), together with the operator's
// per-model active/disabled choice. Only active models are routable by the
// gateway and advertised on /v1/models — this is what lets a client call a
// bare model id ("deepseek-v4.1-flash" instead of
// "custom-openai-zrouter/deepseek-v4.1-flash") for the models the operator
// actually wants served.
//
// The design mirrors IDrouter's user-models store: one JSON blob per provider
// in the settings kv table, written on refresh/state changes and read during
// resolution.
package modelcatalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/repositories"
)

const (
	// BlobVersion is the current wire format. An unknown version is treated
	// as no catalog so the next sync rewrites the blob instead of failing.
	BlobVersion = 2

	// StateActive marks a model as routable and advertised.
	StateActive = "active"
	// StateDisabled marks a model as excluded from routing and the listing.
	// The choice persists across syncs, even if the model temporarily
	// disappears from the upstream list.
	StateDisabled = "disabled"
)

var (
	// ErrNoCatalog reports that a provider has no usable stored catalog:
	// never synced, corrupt, or written by an incompatible version.
	ErrNoCatalog = errors.New("modelcatalog: no stored catalog for provider")
	// ErrUnknownModel reports that an id is not part of the stored catalog.
	ErrUnknownModel = errors.New("modelcatalog: model not in catalog")
	// ErrInvalidState reports a state value other than active/disabled.
	ErrInvalidState = errors.New("modelcatalog: state must be active or disabled")
)

// ModelEntry is one upstream model and its operator-set state.
type ModelEntry struct {
	ID    string `json:"id"`
	State string `json:"state"`
}

// Catalog is the stored model list of one custom provider.
type Catalog struct {
	Version   int          `json:"version"`
	FetchedAt time.Time    `json:"fetched_at"`
	Models    []ModelEntry `json:"models"`
}

// StateUpdate sets one model's state.
type StateUpdate struct {
	ID    string
	State string
}

// SettingsKey returns the settings kv key for a provider slug.
func SettingsKey(providerSlug string) string {
	return SettingsKeyPrefix + providerSlug
}

// SettingsKeyPrefix is prepended to the provider slug for the settings key.
const SettingsKeyPrefix = "provider_models_"

// Store persists a freshly fetched upstream id list as the provider's
// catalog, reconciling it with the previous one the way IDrouter's merge
// does: models the operator disabled stay disabled (even when they
// disappeared from the upstream list, so a returning model re-applies the
// choice), and everything else arrives active.
func Store(ctx context.Context, r *repositories.SettingRepository, providerSlug string, fetched []string) (Catalog, error) {
	prev := make(map[string]string)
	if cat, err := Load(ctx, r, providerSlug); err == nil {
		for _, m := range cat.Models {
			prev[m.ID] = m.State
		}
	}

	seen := make(map[string]bool, len(fetched))
	models := make([]ModelEntry, 0, len(fetched))
	for _, id := range fetched {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		state := StateActive
		if prev[id] == StateDisabled {
			state = StateDisabled
		}
		models = append(models, ModelEntry{ID: id, State: state})
	}

	var vanished []string
	for id, state := range prev {
		if state == StateDisabled && !seen[id] {
			vanished = append(vanished, id)
		}
	}
	sort.Strings(vanished)
	for _, id := range vanished {
		models = append(models, ModelEntry{ID: id, State: StateDisabled})
	}

	return persist(ctx, r, providerSlug, Catalog{Version: BlobVersion, FetchedAt: time.Now(), Models: models})
}

// SetStates applies active/disabled updates to the stored catalog and
// persists it. Every id must already be part of the catalog — adding models
// the upstream does not serve is the dashboard's future "custom models"
// feature, not a state change.
func SetStates(ctx context.Context, r *repositories.SettingRepository, providerSlug string, updates []StateUpdate) (Catalog, error) {
	cat, err := Load(ctx, r, providerSlug)
	if err != nil {
		return Catalog{}, err
	}

	index := make(map[string]int, len(cat.Models))
	for i, m := range cat.Models {
		index[m.ID] = i
	}
	for _, u := range updates {
		if u.State != StateActive && u.State != StateDisabled {
			return Catalog{}, fmt.Errorf("%w: %q", ErrInvalidState, u.State)
		}
		i, ok := index[u.ID]
		if !ok {
			return Catalog{}, fmt.Errorf("%w: %s", ErrUnknownModel, u.ID)
		}
		cat.Models[i].State = u.State
	}
	return persist(ctx, r, providerSlug, cat)
}

// Load returns the stored catalog for a provider, or ErrNoCatalog when the
// provider has none. Version-1 blobs (a plain id list, all active) are
// migrated on read.
func Load(ctx context.Context, r *repositories.SettingRepository, providerSlug string) (Catalog, error) {
	raw, err := r.Get(ctx, SettingsKey(providerSlug))
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return Catalog{}, ErrNoCatalog
		}
		return Catalog{}, err
	}

	var blob Catalog
	if jsonErr := json.Unmarshal([]byte(raw), &blob); jsonErr == nil && blob.Version == BlobVersion {
		if blob.Models == nil {
			blob.Models = []ModelEntry{}
		}
		return blob, nil
	}

	// Version 1 stored a plain id list with no per-model state.
	var v1 struct {
		Version   int       `json:"version"`
		FetchedAt time.Time `json:"fetched_at"`
		Models    []string  `json:"models"`
	}
	if jsonErr := json.Unmarshal([]byte(raw), &v1); jsonErr == nil && v1.Version == 1 {
		models := make([]ModelEntry, 0, len(v1.Models))
		for _, id := range v1.Models {
			if id != "" {
				models = append(models, ModelEntry{ID: id, State: StateActive})
			}
		}
		return Catalog{Version: BlobVersion, FetchedAt: v1.FetchedAt, Models: models}, nil
	}
	return Catalog{}, ErrNoCatalog
}

func persist(ctx context.Context, r *repositories.SettingRepository, providerSlug string, cat Catalog) (Catalog, error) {
	if cat.Models == nil {
		cat.Models = []ModelEntry{}
	}
	cat.Version = BlobVersion
	raw, err := json.Marshal(cat)
	if err != nil {
		return Catalog{}, err
	}
	if err := r.Upsert(ctx, SettingsKey(providerSlug), string(raw)); err != nil {
		return Catalog{}, err
	}
	return cat, nil
}
