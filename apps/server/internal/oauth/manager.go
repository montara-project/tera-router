package oauth

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// refreshSkew refreshes a token this long before its actual expiry, so an
// in-flight request never races a just-expired token.
const refreshSkew = 60 * time.Second

// Manager refreshes expiring OAuth access tokens just-in-time. The gateway
// consults it while opening an account's credentials; a refresh persists the
// rotated tokens back into the account row.
type Manager struct {
	Repos   *repositories.Repositories
	Secrets *sealer.Sealer
	Log     *slog.Logger

	// refreshMu and refreshing serialise refresh work per account id. OAuth
	// refresh tokens are single-use: passing the same refresh token twice
	// makes providers answer invalid_grant, which permanently disables the
	// account. The second caller waits for the first to finish, then re-reads
	// the row and reuses the newly rotated token instead of re-sending the
	// consumed one.
	refreshMu  sync.Mutex
	refreshing map[string]*sync.Mutex
}

// NewManager builds a Manager.
func NewManager(repos *repositories.Repositories, secrets *sealer.Sealer, log *slog.Logger) *Manager {
	return &Manager{Repos: repos, Secrets: secrets, Log: log, refreshing: map[string]*sync.Mutex{}}
}

// unlockRefresh returns a release function for the account-scoped refresh
// mutex. Mutexes are created on first use and retained for the process
// lifetime; the map is only touched under refreshMu.
func (m *Manager) unlockRefresh(id string) func() {
	m.refreshMu.Lock()
	mu := m.refreshing[id]
	if mu == nil {
		mu = &sync.Mutex{}
		m.refreshing[id] = mu
	}
	m.refreshMu.Unlock()

	mu.Lock()
	return mu.Unlock
}

// EnsureFresh returns an account whose OAuth access token is valid, refreshing
// it in place (and persisting the new tokens) when it is expired or about to
// expire. Non-OAuth accounts and accounts without an expiry are returned
// unchanged. A refresh failure is returned so the gateway can skip the account
// and fall back to another one.
func (m *Manager) EnsureFresh(ctx context.Context, acc models.Account) (models.Account, error) {
	if m == nil || acc.AuthKind != models.AuthOAuth || acc.TokenExpiresAt == nil {
		return acc, nil
	}
	if time.Until(*acc.TokenExpiresAt) > refreshSkew {
		return acc, nil // still valid
	}
	return m.refresh(ctx, acc)
}

// refresh performs the actual token refresh for one account. Per-account
// singleflight: concurrent callers for the same account are serialised, and
// the second one re-reads the row so it consumes the rotated refresh token
// rather than the one the first call already spent.
func (m *Manager) refresh(ctx context.Context, acc models.Account) (models.Account, error) {
	unlock := m.unlockRefresh(acc.ID)
	defer unlock()

	// Re-read the account inside the lock. If another caller refreshed it
	// while we waited, both the expiry and the (single-use) refresh token have
	// moved — using the stale snapshot would re-send an already-consumed token.
	if latest, err := m.Repos.Accounts.Get(ctx, acc.ID); err == nil {
		acc = latest
	}

	// The waiting caller can answer with the fresh token another refresh just
	// produced.
	if acc.TokenExpiresAt != nil && time.Until(*acc.TokenExpiresAt) > refreshSkew {
		return acc, nil
	}

	cfg, ok := ConfigFor(acc.Provider)
	if !ok {
		// No refresh config; let the gateway try the (possibly stale) token.
		return acc, nil
	}
	if acc.Refresh.Empty() {
		return acc, fmt.Errorf("oauth: no refresh token for account %s", acc.ID)
	}

	refreshToken, err := openModel(m.Secrets, acc.Refresh)
	if err != nil {
		return acc, fmt.Errorf("oauth: open refresh token for account %s: %w", acc.ID, err)
	}

	tokens, err := cfg.Refresh(ctx, refreshToken)
	if err != nil {
		// A permanent failure (token_revoked, invalid_grant, ...) means the
		// refresh token itself is dead: flag the account for reconnection so
		// the dashboard stops dispatching through it.
		if IsPermanentRefresh(err) {
			if setErr := m.Repos.Accounts.SetNeedsReconnect(ctx, acc.ID, true); setErr != nil {
				return acc, fmt.Errorf("oauth: mark reconnect: %w (original: %w)", setErr, err)
			}
			if m.Log != nil {
				m.Log.Warn("oauth refresh permanently failed; account flagged for reconnection", "account", acc.ID, "provider", acc.Provider, "error", err)
			}
		}
		return acc, fmt.Errorf("oauth: refresh failed for account %s: %w", acc.ID, err)
	}

	var expiresAt *time.Time
	if tokens.ExpiresIn > 0 {
		t := time.Now().Add(time.Duration(tokens.ExpiresIn) * time.Second)
		expiresAt = &t
	}

	// Seal the new tokens into the account. The refresh config keeps the old
	// refresh token when the provider omits a new one, so it is always set.
	sealedAccess, serr := sealModel(m.Secrets, tokens.AccessToken)
	if serr != nil {
		return acc, fmt.Errorf("oauth: seal access token: %w", serr)
	}
	sealedRefresh, serr := sealModel(m.Secrets, tokens.RefreshToken)
	if serr != nil {
		return acc, fmt.Errorf("oauth: seal refresh token: %w", serr)
	}
	acc.Token = sealedAccess
	acc.Refresh = sealedRefresh
	acc.TokenExpiresAt = expiresAt

	if err := m.Repos.Accounts.Update(ctx, acc); err != nil {
		return acc, fmt.Errorf("oauth: persist refreshed token: %w", err)
	}
	return acc, nil
}

func sealModel(s *sealer.Sealer, plaintext string) (models.Sealed, error) {
	sealed, err := s.SealString(plaintext)
	if err != nil {
		return models.Sealed{}, err
	}
	return models.Sealed{WrappedDEK: sealed.WrappedDEK, Ciphertext: sealed.Ciphertext}, nil
}

func openModel(s *sealer.Sealer, sealed models.Sealed) (string, error) {
	return s.OpenString(sealer.Sealed{WrappedDEK: sealed.WrappedDEK, Ciphertext: sealed.Ciphertext})
}
