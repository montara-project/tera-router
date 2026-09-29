package gateway

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
)

// Authenticated key context.
//
// The verified key record is stashed in Fiber locals so handlers read it
// without a second lookup. It is set before the handler runs and never
// outlives the request.

const authedKeyLocal = "gateway.apiKey"

// authedKey returns the authenticated key record attached by authMiddleware.
func authedKey(c fiber.Ctx) (models.APIKey, bool) {
	k, ok := c.Locals(authedKeyLocal).(models.APIKey)
	return k, ok
}

// authMiddleware authenticates the inbound API key from `Authorization:
// Bearer <key>` (or a raw Authorization value) or `x-api-key`, and rejects
// unauthenticated requests with 401 in the OpenAI error envelope.
//
// The lookup is two-phase, mirroring how keys are stored: a fast SHA-256
// lookup index finds the candidate row, then argon2id verifies the plaintext.
// Because argon2 is expensive (64 MiB, 4 threads per verification), successful
// results are cached briefly — see authCache.
func (s *Server) authMiddleware(c fiber.Ctx) error {
	token := extractToken(c)
	if token == "" {
		return writeError(c, http.StatusUnauthorized, "missing API key")
	}

	key, err := s.authenticate(c.Context(), token)
	if err != nil {
		if errors.Is(err, errUnauthorized) {
			return writeError(c, http.StatusUnauthorized, "invalid API key")
		}
		s.log.Error("gateway auth lookup failed", "error", err)
		return writeError(c, http.StatusInternalServerError, "authentication error")
	}

	c.Locals(authedKeyLocal, key)
	return c.Next()
}

// extractToken pulls the API key from the standard header locations.
func extractToken(c fiber.Ctx) string {
	if auth := c.Get("Authorization"); auth != "" {
		if after, ok := strings.CutPrefix(auth, "Bearer "); ok {
			return strings.TrimSpace(after)
		}
		return strings.TrimSpace(auth)
	}
	if k := c.Get("x-api-key"); k != "" {
		return strings.TrimSpace(k)
	}
	return ""
}

// errUnauthorized signals a rejected credential (invalid, disabled, or
// unknown). Distinct from a lookup failure so the middleware can tell "your
// key is bad" (401) from "we could not check" (500).
var errUnauthorized = errors.New("gateway: unauthorized")

// authenticate resolves and verifies a presented plaintext key.
func (s *Server) authenticate(ctx context.Context, plaintext string) (models.APIKey, error) {
	if plaintext == "" {
		return models.APIKey{}, errUnauthorized
	}
	lookup := apikey.LookupHash(plaintext)

	if rec, ok := s.auth.get(lookup); ok {
		// A key disabled since it was cached must stop working immediately.
		if rec.Disabled {
			s.auth.invalidate(lookup)
			return models.APIKey{}, errUnauthorized
		}
		return rec, nil
	}

	rec, err := s.app.Repos.APIKeys.GetByLookup(ctx, lookup)
	if err != nil {
		if errors.Is(err, apperr.ErrNotFound) {
			return models.APIKey{}, errUnauthorized
		}
		return models.APIKey{}, err
	}
	if rec.Disabled {
		return models.APIKey{}, errUnauthorized
	}

	ok, err := apikey.Verify(plaintext, rec.KeyHash)
	if err != nil || !ok {
		return models.APIKey{}, errUnauthorized
	}

	s.auth.put(lookup, rec)

	// Best-effort last-used stamp; a failure here must not fail the request.
	go func(id string) {
		touchCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.app.Repos.APIKeys.TouchLastUsed(touchCtx, id, time.Now()); err != nil {
			s.log.Debug("gateway touch last used failed", "error", err, "key", id)
		}
	}(rec.ID)

	return rec, nil
}

// authCacheTTL bounds how long a verified key is trusted without re-running
// argon2. Short enough that a disabled key stops working within seconds, long
// enough to absorb a coding agent's burst of requests.
const authCacheTTL = 5 * time.Minute

// authCacheMaxEntries caps the cache so a spray of invalid keys cannot grow it
// without bound.
const authCacheMaxEntries = 1024

// authCache memoizes verified API keys by their lookup hash. The zero value is
// not usable; build one with newAuthCache.
type authCache struct {
	mu      sync.RWMutex
	entries map[string]authCacheEntry
}

type authCacheEntry struct {
	record  models.APIKey
	expires time.Time
}

func newAuthCache() authCache {
	return authCache{entries: make(map[string]authCacheEntry)}
}

// get returns a cached key when its entry is still fresh.
func (a *authCache) get(lookup string) (models.APIKey, bool) {
	a.mu.RLock()
	ent, ok := a.entries[lookup]
	a.mu.RUnlock()
	if !ok || time.Now().After(ent.expires) {
		return models.APIKey{}, false
	}
	return ent.record, true
}

// put stores a verified key, evicting the entry closest to expiry when the
// cache is full.
func (a *authCache) put(lookup string, rec models.APIKey) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if _, exists := a.entries[lookup]; !exists && len(a.entries) >= authCacheMaxEntries {
		var oldestKey string
		var oldestExpiry time.Time
		for k, v := range a.entries {
			if oldestKey == "" || v.expires.Before(oldestExpiry) {
				oldestKey, oldestExpiry = k, v.expires
			}
		}
		delete(a.entries, oldestKey)
	}
	a.entries[lookup] = authCacheEntry{record: rec, expires: time.Now().Add(authCacheTTL)}
}

// invalidate drops one cached entry.
func (a *authCache) invalidate(lookup string) {
	a.mu.Lock()
	delete(a.entries, lookup)
	a.mu.Unlock()
}
