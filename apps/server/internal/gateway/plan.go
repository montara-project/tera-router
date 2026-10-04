package gateway

import (
	"context"
	"errors"
	"sync"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"
)

// attempt is one fully-resolved try: which connector to call, which account it
// belongs to, and the credentials to use.
type attempt struct {
	Target    target
	Conn      core.Connector
	Creds     core.Credentials
	AccountID string
	// Synthetic marks an attempt for a provider that authenticates by network
	// position rather than credentials (AuthNone) and therefore has no account
	// row. It is never cooled down and records no account id.
	Synthetic bool
}

// plan turns an ordered target list into an ordered attempt list.
//
// Targets that cannot be routed (unknown provider, non-routable dialect, no
// connector for the dialect) are skipped. For each routable target the
// provider's usable accounts are expanded in priority order. Providers that
// authenticate by network position (AuthNone: self-hosted vLLM, local Ollama)
// with no account rows still get one synthetic credential-less attempt, so a
// correctly configured local endpoint works without a fake account.
//
// The result is capped at maxAttempts to bound the work a single request can
// trigger.
func (s *Server) plan(ctx context.Context, targets []target) []attempt {
	out := make([]attempt, 0, len(targets))

	for _, t := range targets {
		if len(out) >= maxAttempts {
			break
		}

		spec, ok := s.providerSpec(ctx, t.Provider)
		if !ok || spec.Dialect == "" {
			s.log.Debug("gateway skip unroutable target", "provider", t.Provider, "model", t.Model)
			continue
		}

		conn, err := s.conns.For(spec.Slug, spec.Dialect, spec.BaseURL)
		if err != nil {
			s.log.Warn("gateway no connector for target",
				"provider", t.Provider, "dialect", string(spec.Dialect), "error", err)
			continue
		}

		accounts, err := s.app.Repos.Accounts.ListUsable(ctx, t.Provider)
		if err != nil {
			s.log.Error("gateway list accounts failed", "provider", t.Provider, "error", err)
			continue
		}

		if len(accounts) == 0 {
			// AuthNone providers need no account row: one synthetic attempt
			// with empty credentials.
			if spec.AuthKind == string(models.AuthNone) {
				out = append(out, attempt{
					Target:    t,
					Conn:      conn,
					Creds:     core.Credentials{Headers: map[string]string{}},
					Synthetic: true,
				})
			}
			continue
		}

		for _, acc := range accounts {
			if len(out) >= maxAttempts {
				break
			}
			if s.cooldowns.active(acc.ID) {
				continue
			}
			creds, cerr := s.credentials(ctx, acc)
			if cerr != nil {
				s.log.Warn("gateway open credentials failed", "provider", t.Provider, "account", acc.ID, "error", cerr)
				continue
			}
			out = append(out, attempt{Target: t, Conn: conn, Creds: creds, AccountID: acc.ID})
		}
	}

	return out
}

// credentials opens an account's sealed secret material and resolves its
// endpoint, extra headers, and proxy binding into the connector's credential
// struct.
func (s *Server) credentials(ctx context.Context, acc models.Account) (core.Credentials, error) {
	creds := core.Credentials{AccountID: acc.ID, Headers: map[string]string{}}

	// OAuth accounts (anthropic, codex) refresh their access token just in time
	// when it is expired or about to expire; the rotated tokens are persisted
	// so the next dispatch reuses them. A failed refresh skips the account so
	// the dispatcher falls back to another one.
	acc, err := s.app.OAuth.EnsureFresh(ctx, acc)
	if err != nil {
		return core.Credentials{}, err
	}

	if !acc.Secret.Empty() {
		key, err := s.app.Secrets.OpenString(acc.Secret)
		if err != nil {
			return core.Credentials{}, err
		}
		creds.APIKey = key
	}
	if !acc.Token.Empty() {
		token, err := s.app.Secrets.OpenString(acc.Token)
		if err != nil {
			return core.Credentials{}, err
		}
		creds.AccessToken = token
	}

	meta := parseAccountMetadata(acc.Metadata)
	// An account-level base_url overrides the provider default.
	creds.BaseURL = meta.BaseURL
	for k, v := range meta.Headers {
		creds.Headers[k] = v
	}

	if acc.ProxyPoolID != nil && *acc.ProxyPoolID != "" {
		pool, err := s.app.Repos.ProxyPools.Get(ctx, *acc.ProxyPoolID)
		switch {
		case err != nil:
			// A missing or unreadable pool must not strand the account: fall
			// back to a direct connection.
			s.log.Warn("gateway proxy pool lookup failed", "account", acc.ID, "pool", *acc.ProxyPoolID, "error", err)
		case pool.Status == proxyPoolActive:
			creds.ProxyURL = pool.URL
		}
	}

	return creds, nil
}

// proxyPoolActive is the proxy_pools.status value meaning "probe succeeded".
const proxyPoolActive = "active"

// cooldownTracker parks accounts that recently failed in a way that will not
// recover on an immediate retry: rate limits and rejected credentials. It is
// deliberately in-memory — losing it on restart only means one extra upstream
// attempt, which is cheaper than persisting it.
type cooldownTracker struct {
	mu      sync.Mutex
	entries map[string]time.Time
}

func newCooldownTracker() cooldownTracker {
	return cooldownTracker{entries: make(map[string]time.Time)}
}

// active reports whether an account is currently parked.
func (c *cooldownTracker) active(accountID string) bool {
	if accountID == "" {
		return false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	until, ok := c.entries[accountID]
	if !ok {
		return false
	}
	if time.Now().After(until) {
		delete(c.entries, accountID)
		return false
	}
	return true
}

// coolDown parks an account for the given duration, keeping the longest
// outstanding penalty when one is already active.
func (c *cooldownTracker) coolDown(accountID string, d time.Duration) {
	if accountID == "" || d <= 0 {
		return
	}
	until := time.Now().Add(d)
	c.mu.Lock()
	defer c.mu.Unlock()
	if existing, ok := c.entries[accountID]; ok && existing.After(until) {
		return
	}
	c.entries[accountID] = until
}

// noteFailure applies the cooldown policy for a failed attempt. Rate limits use
// the upstream's Retry-After when present, otherwise a short default; rejected
// credentials and suspended accounts are parked for longer because nothing
// changes until an operator intervenes.
func (s *Server) noteFailure(pe *core.ProviderError) {
	if pe == nil || pe.AccountID == "" {
		return
	}
	switch pe.Kind {
	case core.ErrRateLimit, core.ErrQuotaExhausted, core.ErrCapacity:
		d := pe.RetryAfter
		if d <= 0 {
			d = cooldownRateLimit
		}
		s.cooldowns.coolDown(pe.AccountID, d)
	case core.ErrAuth, core.ErrAccountSuspended, core.ErrBilling:
		s.cooldowns.coolDown(pe.AccountID, cooldownAuth)
	}
}

// shouldRetrySameAccount reports whether a failure warrants retrying on the
// same account before falling back. Only transient upstream faults and timeouts
// qualify: a bad request or a rejected credential will fail identically.
func shouldRetrySameAccount(pe *core.ProviderError) bool {
	if pe == nil {
		return false
	}
	switch pe.Kind {
	case core.ErrUpstream, core.ErrTimeout:
		return true
	default:
		return false
	}
}

// retryBackoff returns the delay before same-account retry n (0-based):
// retryBackoffBase doubled per attempt. It returns 0 when the request deadline
// is too close for a sleep to be worthwhile — the caller then falls back to the
// next target instead of spending the client's remaining time waiting.
func retryBackoff(ctx context.Context, n int) time.Duration {
	d := retryBackoffBase << n
	if deadline, ok := ctx.Deadline(); ok {
		if time.Until(deadline) < d+retryDeadlineFloor {
			return 0
		}
	}
	return d
}

// sleep waits for d or until ctx is done, returning the context error when
// interrupted. A zero duration returns immediately.
func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// errNoAttempts is returned when planning produced nothing usable, which means
// no account can serve the requested model.
var errNoAttempts = errors.New("no available account")
