package gateway

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/models"
)

// accountRotation is the in-memory state behind the round robin account
// strategies: a per-provider cursor and smart round robin's session → account
// bindings. Like chain rotation it only shapes load, so losing it on restart
// is a harmless rebalancing.
type accountRotation struct {
	mu       sync.Mutex
	cursors  map[string]*accountCursor
	sessions map[string]sessionBinding
}

// accountCursor points at the account currently taking requests (or new
// sessions) and how many it has taken.
type accountCursor struct {
	index int
	used  int
}

// sessionBinding pins one conversation to an account until it expires; every
// request in the conversation slides the expiry forward.
type sessionBinding struct {
	accountID string
	expires   time.Time
}

// sessionPruneThreshold is the binding count above which a new binding first
// sweeps out the expired ones.
const sessionPruneThreshold = 1024

func newAccountRotation() accountRotation {
	return accountRotation{cursors: map[string]*accountCursor{}, sessions: map[string]sessionBinding{}}
}

// next returns the cursor position for provider: the same account answers
// limit times, then the next one takes over.
func (r *accountRotation) next(provider string, n, limit int) int {
	c := r.cursors[provider]
	if c == nil {
		c = &accountCursor{}
		r.cursors[provider] = c
	}
	if c.used >= max(limit, 1) {
		c.index++
		c.used = 0
	}
	c.used++
	return c.index % n
}

// order arranges a provider's usable accounts (priority order) for one
// request. The first account is the preferred one; the rest stay as fallbacks
// so a failure still reaches every account. usable reports whether an account
// can take traffic right now (not cooled down); smart round robin binds new
// sessions only to such accounts.
func (r *accountRotation) order(provider string, accounts []models.Account, cfg models.ProviderRouting, session string, usable func(string) bool, now time.Time) []models.Account {
	if len(accounts) <= 1 {
		return accounts
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	switch cfg.Strategy {
	case models.AccountStrategyRoundRobin:
		return rotateAccounts(accounts, r.next(provider, len(accounts), cfg.StickyLimit))

	case models.AccountStrategySmartRoundRobin:
		if session == "" {
			// No way to tell conversations apart: every request is new.
			return rotateAccounts(accounts, r.next(provider, len(accounts), cfg.StickyLimit))
		}
		key := provider + "\x00" + session
		ttl := time.Duration(max(cfg.AffinityHours, 1)) * time.Hour
		if b, ok := r.sessions[key]; ok && now.Before(b.expires) {
			for i, acc := range accounts {
				if acc.ID == b.accountID {
					r.sessions[key] = sessionBinding{accountID: b.accountID, expires: now.Add(ttl)}
					return rotateAccounts(accounts, i)
				}
			}
			// The bound account is gone (disabled, deleted): rebind below.
		}

		start := r.next(provider, len(accounts), cfg.StickyLimit)
		for i := range accounts {
			if usable(accounts[(start+i)%len(accounts)].ID) {
				start = (start + i) % len(accounts)
				break
			}
		}
		if len(r.sessions) >= sessionPruneThreshold {
			// ponytail: O(n) sweep only once the map is large; a timer-driven
			// prune would bound memory under a flood of one-shot sessions.
			for k, b := range r.sessions {
				if !now.Before(b.expires) {
					delete(r.sessions, k)
				}
			}
		}
		r.sessions[key] = sessionBinding{accountID: accounts[start].ID, expires: now.Add(ttl)}
		return rotateAccounts(accounts, start)

	default: // fill-first
		return accounts
	}
}

// rotateAccounts returns accounts starting at index start, wrapping around.
func rotateAccounts(accounts []models.Account, start int) []models.Account {
	if start == 0 {
		return accounts
	}
	out := make([]models.Account, 0, len(accounts))
	out = append(out, accounts[start:]...)
	return append(out, accounts[:start]...)
}

// accountStrategy resolves a provider's effective account strategy. The
// router default follows the global Settings › Routing switch: round robin
// with the global sticky limit when it is on, fill first otherwise.
func (s *Server) accountStrategy(ctx context.Context, provider string) models.ProviderRouting {
	cfg, err := s.app.Repos.Settings.ProviderRouting(ctx, provider)
	if err != nil {
		s.log.Warn("gateway load account strategy failed", "provider", provider, "error", err)
		cfg = models.DefaultProviderRouting()
	}
	if cfg.Strategy != models.AccountStrategyDefault && cfg.Strategy != "" {
		return cfg
	}

	st, err := s.loadAppSettings(ctx)
	if err != nil {
		s.log.Warn("gateway load settings failed", "error", err)
		return models.ProviderRouting{Strategy: models.AccountStrategyFillFirst}
	}
	if on(st.ProviderRoundRobin) {
		return models.ProviderRouting{Strategy: models.AccountStrategyRoundRobin, StickyLimit: deref(st.ProviderStickyLimit)}
	}
	return models.ProviderRouting{Strategy: models.AccountStrategyFillFirst}
}

// sessionKey identifies the conversation a request belongs to, for smart
// round robin. A session id the client names is used first: Claude Code
// carries it in metadata.user_id and Codex sends prompt_cache_key. Otherwise
// the conversation's opening (system prompt plus first user message) is the
// same on every turn. Keys are scoped to the inbound API key; "" means the
// request carries nothing to tell conversations apart.
func sessionKey(req *core.ChatRequest) string {
	id := clientSessionID(req.Extra)
	if id == "" {
		opening := firstUserText(req.Messages)
		if opening == "" && req.System == "" {
			return ""
		}
		id = req.System + "\x00" + opening
	}
	sum := sha256.Sum256([]byte(req.Metadata.APIKeyID + "\x00" + id))
	return hex.EncodeToString(sum[:16])
}

// clientSessionID reads a session id the client put in the request body.
func clientSessionID(extra map[string]json.RawMessage) string {
	var meta struct {
		UserID string `json:"user_id"`
	}
	if raw, ok := extra["metadata"]; ok && json.Unmarshal(raw, &meta) == nil && meta.UserID != "" {
		return "user_id:" + meta.UserID
	}
	var cacheKey string
	if raw, ok := extra["prompt_cache_key"]; ok && json.Unmarshal(raw, &cacheKey) == nil && cacheKey != "" {
		return "prompt_cache_key:" + cacheKey
	}
	return ""
}

// firstUserText is the text of the conversation's first user message.
func firstUserText(messages []core.Message) string {
	for _, m := range messages {
		if m.Role != core.RoleUser {
			continue
		}
		return m.TextContent()
	}
	return ""
}
