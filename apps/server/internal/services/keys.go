package services

import (
	"context"
	"fmt"

	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

type KeyService struct {
	repos   *repositories.Repositories
	secrets *sealer.Sealer
	audit   *AuditService
}

// CreatedKey is the result of minting a key: the stored record plus the
// plaintext, which is shown exactly once.
type CreatedKey struct {
	Key       models.APIKey `json:"key"`
	Plaintext string        `json:"plaintext"`
	Display   string        `json:"display"`
}

// Create mints a new API key. Only hashes and the envelope-encrypted copy are
// persisted; the plaintext is recoverable later only via Reveal.
func (s *KeyService) Create(ctx context.Context, actor, name, planID, scopes string) (CreatedKey, error) {
	gen, err := apikey.Generate()
	if err != nil {
		return CreatedKey{}, err
	}

	sealed, err := s.secrets.SealString(gen.Plaintext)
	if err != nil {
		return CreatedKey{}, err
	}

	var planPtr *string
	if planID != "" {
		if _, err := s.repos.Plans.FindByID(ctx, planID); err != nil {
			return CreatedKey{}, fmt.Errorf("plan %s: %w", planID, err)
		}
		planPtr = &planID
	}

	key := models.APIKey{
		ID:         uuid.NewString(),
		PlanID:     planPtr,
		Name:       name,
		KeyHash:    gen.Hash,
		LookupHash: gen.Lookup,
		Display:    gen.Display,
		Scopes:     scopes,
		Secret:     toModelsSealed(sealed),
	}
	if err := s.repos.APIKeys.Create(ctx, key); err != nil {
		return CreatedKey{}, err
	}

	s.audit.Record(ctx, actor, "key.create", key.ID, map[string]string{"name": name})
	return CreatedKey{Key: key, Plaintext: gen.Plaintext, Display: gen.Display}, nil
}

// List returns paginated keys with their plan labels for the dashboard.
func (s *KeyService) List(ctx context.Context, offset, limit int) ([]repositories.APIKeyWithPlan, int, error) {
	return s.repos.APIKeys.List(ctx, offset, limit)
}

// Get returns one key by id.
func (s *KeyService) Get(ctx context.Context, id string) (models.APIKey, error) {
	return s.repos.APIKeys.FindByID(ctx, id)
}

// Update mutates name/plan/scopes/disabled on an existing key.
func (s *KeyService) Update(ctx context.Context, actor, id string, name string, planID *string, scopes *string, disabled *bool) (models.APIKey, error) {
	key, err := s.repos.APIKeys.FindByID(ctx, id)
	if err != nil {
		return models.APIKey{}, err
	}
	if name != "" {
		key.Name = name
	}
	if planID != nil {
		if *planID == "" {
			key.PlanID = nil
		} else {
			if _, err := s.repos.Plans.FindByID(ctx, *planID); err != nil {
				return models.APIKey{}, fmt.Errorf("plan %s: %w", *planID, err)
			}
			key.PlanID = planID
		}
	}
	if scopes != nil {
		key.Scopes = *scopes
	}
	if disabled != nil {
		key.Disabled = *disabled
	}

	if err := s.repos.APIKeys.Update(ctx, key); err != nil {
		return models.APIKey{}, err
	}
	s.audit.Record(ctx, actor, "key.update", id, map[string]any{"disabled": key.Disabled})
	return key, nil
}

// Delete removes a key.
func (s *KeyService) Delete(ctx context.Context, actor, id string) error {
	if err := s.repos.APIKeys.Delete(ctx, id); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "key.delete", id, nil)
	return nil
}

// Reveal decrypts the stored copy of the key plaintext for explicit,
// audit-logged recovery. Auth never consults these columns.
func (s *KeyService) Reveal(ctx context.Context, actor, id string) (string, error) {
	key, err := s.repos.APIKeys.FindByID(ctx, id)
	if err != nil {
		return "", err
	}
	if key.Secret.Empty() {
		return "", apperr.New(apperr.KindUnprocessable, "key has no recoverable secret")
	}

	plaintext, err := s.secrets.OpenString(fromModelsSealed(key.Secret))
	if err != nil {
		return "", err
	}
	s.audit.Record(ctx, actor, "key.reveal", id, nil)
	return plaintext, nil
}
