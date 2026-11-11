package gateway

import (
	"context"
	"sync"

	"tera-router/server/internal/core"
	"tera-router/server/internal/lib/cost"
)

// Usage reservations.
//
// Budgets, plan caps and TPM are checked against usage_records, which only
// learns about a request once it has finished and its row is written. Left at
// that, a burst of concurrent requests all read the same total and all pass a
// limit that one of them alone would have reached. So every admitted request
// reserves an estimate of its usage, and each check adds the reservations made
// before its own to the recorded total — the same answer serving the burst one
// request at a time would give. A reservation lasts until the request is over
// and every usage row it produced has reached the database, so its usage is
// never missing from both places at once.
// ponytail: per-process state, like keyLimiter; a multi-instance deployment
// needs a shared store for this to hold across instances. Account-scoped
// budgets are not reserved: the account is only known per attempt.

// reservedUsage is one request's estimated usage: spend and rate-scaled tokens
// for budgets and plan caps, raw tokens for TPM.
type reservedUsage struct {
	usageTotals
	Raw int64
}

type reservations struct {
	mu     sync.Mutex
	seq    uint64
	active map[*reservation]struct{}
}

func newReservations() *reservations {
	return &reservations{active: map[*reservation]struct{}{}}
}

// reservation is one request's hold on its estimate. A nil reservation is
// valid and reserves nothing.
type reservation struct {
	set   *reservations
	keyID string
	est   reservedUsage
	seq   uint64
	refs  int
}

// reserve registers est for a request of keyID. The caller releases it once
// when the request ends.
func (r *reservations) reserve(keyID string, est reservedUsage) *reservation {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.seq++
	res := &reservation{set: r, keyID: keyID, est: est, seq: r.seq, refs: 1}
	r.active[res] = struct{}{}
	return res
}

// hold keeps the reservation alive for one more release: a usage row on its
// way to the database takes one.
func (res *reservation) hold() {
	if res == nil {
		return
	}
	res.set.mu.Lock()
	defer res.set.mu.Unlock()
	res.refs++
}

// release drops one hold and frees the estimate with the last.
func (res *reservation) release() {
	if res == nil {
		return
	}
	res.set.mu.Lock()
	defer res.set.mu.Unlock()
	if res.refs--; res.refs <= 0 {
		delete(res.set.active, res)
	}
}

// earlier sums what requests admitted before res still hold, for its key and
// for the tenant as a whole. Later ones are left out: they count res instead,
// so two requests racing for the last of a budget cannot reject each other.
func (res *reservation) earlier() (key, tenant reservedUsage) {
	if res == nil {
		return
	}
	res.set.mu.Lock()
	defer res.set.mu.Unlock()
	for other := range res.set.active {
		if other.seq >= res.seq {
			continue
		}
		tenant = tenant.plus(other.est)
		if other.keyID == res.keyID {
			key = key.plus(other.est)
		}
	}
	return key, tenant
}

func (u reservedUsage) plus(v reservedUsage) reservedUsage {
	u.usageTotals = u.usageTotals.plus(v.usageTotals)
	u.Raw += v.Raw
	return u
}

func (u usageTotals) plus(v usageTotals) usageTotals {
	return usageTotals{Micros: u.Micros + v.Micros, Tokens: u.Tokens + v.Tokens}
}

// estimateUsage is what a chat request is known to use before it runs: its
// prompt, priced at the first target's rates.
// ponytail: completion tokens are unknown at admission and not reserved, so a
// burst can still overshoot by its own output. Reserving max_tokens would
// close that, at the price of rejecting requests that would have fit (agents
// send a large max_tokens on every call).
func (s *Server) estimateUsage(ctx context.Context, req *core.ChatRequest, t target) reservedUsage {
	prompt := int64(estimateInputTokens(req))
	rates, tokenRate := s.pricingFor(ctx, t.Provider, t.Model)
	scaled := prompt
	if tokenRate != nil {
		scaled = int64(float64(prompt) * *tokenRate)
	}
	return reservedUsage{
		usageTotals: usageTotals{Micros: cost.Micros(rates, prompt, 0, 0, 0, 0), Tokens: scaled},
		Raw:         prompt,
	}
}
