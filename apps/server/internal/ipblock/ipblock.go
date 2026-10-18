// Package ipblock keeps the client address blocklist in memory, so every
// request is checked without a database read, and turns repeated failed
// sign-ins from one address into a temporary block.
package ipblock

import (
	"context"
	"fmt"
	"net/netip"
	"sync"
	"time"

	"tera-router/server/internal/repositories"
)

const (
	// FailLimit failed sign-ins inside FailWindow block the address for
	// BlockMinutes.
	FailLimit    = 10
	FailWindow   = 15 * time.Minute
	BlockMinutes = 15
)

type block struct {
	prefix netip.Prefix
	until  time.Time // zero means permanent
}

type failures struct {
	count int
	since time.Time
}

// Guard answers "is this address blocked" from memory and mirrors the
// ip_blocks table, which stays the source of truth across restarts.
type Guard struct {
	repo *repositories.IPBlockRepository

	mu     sync.RWMutex
	blocks []block
	fails  map[netip.Addr]failures
}

func New(repo *repositories.IPBlockRepository) *Guard {
	return &Guard{repo: repo, fails: map[netip.Addr]failures{}}
}

// Reload replaces the in-memory list with the stored one. Call it at boot and
// after every change to the table.
func (g *Guard) Reload(ctx context.Context) error {
	rows, err := g.repo.ListActive(ctx)
	if err != nil {
		return err
	}
	blocks := make([]block, 0, len(rows))
	for _, r := range rows {
		p, err := ParsePrefix(r.CIDR)
		if err != nil {
			continue
		}
		b := block{prefix: p}
		if r.ExpiresAt != nil {
			b.until = *r.ExpiresAt
		}
		blocks = append(blocks, b)
	}

	g.mu.Lock()
	g.blocks = blocks
	g.mu.Unlock()
	return nil
}

// Blocked reports whether ip falls in an unexpired block. Loopback is never
// blocked: it is the health check, the local operator and cloudflared.
// ponytail: linear scan, fine for hundreds of entries; switch to a prefix trie
// if the list grows to many thousands.
func (g *Guard) Blocked(ip netip.Addr, now time.Time) bool {
	ip = ip.Unmap()
	if ip.IsLoopback() {
		return false
	}
	g.mu.RLock()
	defer g.mu.RUnlock()
	for _, b := range g.blocks {
		if b.prefix.Contains(ip) && (b.until.IsZero() || now.Before(b.until)) {
			return true
		}
	}
	return false
}

// Fail records a failed sign-in from ip. Reaching FailLimit inside FailWindow
// stores a temporary block and reloads the list. Successful sign-ins do not
// reset the count: a correct password alone would otherwise let an attacker
// retry TOTP codes forever.
func (g *Guard) Fail(ctx context.Context, ip netip.Addr, now time.Time) error {
	ip = ip.Unmap()
	if ip.IsLoopback() {
		return nil
	}

	g.mu.Lock()
	f := g.fails[ip]
	if now.Sub(f.since) > FailWindow {
		f = failures{since: now}
	}
	f.count++
	reached := f.count >= FailLimit
	if reached {
		delete(g.fails, ip)
	} else {
		g.fails[ip] = f
	}
	// ponytail: the counter map only shrinks when an address hits the limit;
	// prune stale entries on a timer if a large botnet makes it grow.
	g.mu.Unlock()

	if !reached {
		return nil
	}
	cidr := netip.PrefixFrom(ip, ip.BitLen()).String()
	reason := fmt.Sprintf("auto: %d failed sign-ins", FailLimit)
	if err := g.repo.BlockFor(ctx, cidr, reason, BlockMinutes); err != nil {
		return err
	}
	return g.Reload(ctx)
}

// ParsePrefix accepts a single address ("203.0.113.7") or a range
// ("10.0.0.0/8") and returns the canonical masked prefix.
func ParsePrefix(s string) (netip.Prefix, error) {
	if addr, err := netip.ParseAddr(s); err == nil {
		addr = addr.Unmap()
		return netip.PrefixFrom(addr, addr.BitLen()), nil
	}
	p, err := netip.ParsePrefix(s)
	if err != nil {
		return netip.Prefix{}, err
	}
	return p.Masked(), nil
}
