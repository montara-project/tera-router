package ipblock

import (
	"context"
	"net/netip"
	"path/filepath"
	"testing"
	"time"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/repositories"
)

func newGuard(t *testing.T) (*Guard, *repositories.IPBlockRepository) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "ipblock_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	repo := repositories.New(db, &config.ConfigApp{}).IPBlocks
	return New(repo), repo
}

func TestManualBlockMatchesRange(t *testing.T) {
	g, repo := newGuard(t)
	ctx := context.Background()
	if _, err := repo.Insert(ctx, "10.0.0.0/8", "office"); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Insert(ctx, "10.0.0.0/8", "dup"); err == nil {
		t.Fatal("duplicate range should conflict")
	}
	if err := g.Reload(ctx); err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	if !g.Blocked(netip.MustParseAddr("10.20.30.40"), now) {
		t.Error("address inside the range should be blocked")
	}
	if !g.Blocked(netip.MustParseAddr("::ffff:10.1.1.1"), now) {
		t.Error("IPv4-mapped IPv6 should match the IPv4 range")
	}
	if g.Blocked(netip.MustParseAddr("11.0.0.1"), now) {
		t.Error("address outside the range should pass")
	}
}

func TestFailuresTriggerTemporaryBlock(t *testing.T) {
	g, repo := newGuard(t)
	ctx := context.Background()
	ip := netip.MustParseAddr("203.0.113.7")
	now := time.Now()

	for i := 1; i < FailLimit; i++ {
		if err := g.Fail(ctx, ip, now); err != nil {
			t.Fatal(err)
		}
	}
	if g.Blocked(ip, now) {
		t.Fatal("blocked before reaching the limit")
	}
	if err := g.Fail(ctx, ip, now); err != nil {
		t.Fatal(err)
	}
	if !g.Blocked(ip, now) {
		t.Fatal("limit reached but address not blocked")
	}
	if g.Blocked(ip, now.Add(BlockMinutes*time.Minute+time.Minute)) {
		t.Error("temporary block should expire")
	}

	rows, err := repo.ListActive(ctx)
	if err != nil || len(rows) != 1 || rows[0].CIDR != "203.0.113.7/32" || rows[0].ExpiresAt == nil {
		t.Fatalf("stored blocks = %+v, %v", rows, err)
	}

	// Failures spread over more than the window never add up to a block.
	other := netip.MustParseAddr("198.51.100.9")
	for i := 0; i < FailLimit; i++ {
		_ = g.Fail(ctx, other, now.Add(time.Duration(i)*(FailWindow/2+time.Second)))
	}
	if g.Blocked(other, now.Add(time.Hour)) {
		t.Error("failures outside the window should not block")
	}
}

func TestAutoBlockKeepsPermanentBlock(t *testing.T) {
	g, repo := newGuard(t)
	ctx := context.Background()
	if _, err := repo.Insert(ctx, "203.0.113.7/32", "manual"); err != nil {
		t.Fatal(err)
	}
	if err := repo.BlockFor(ctx, "203.0.113.7/32", "auto", BlockMinutes); err != nil {
		t.Fatal(err)
	}
	if err := g.Reload(ctx); err != nil {
		t.Fatal(err)
	}
	if !g.Blocked(netip.MustParseAddr("203.0.113.7"), time.Now().Add(24*time.Hour)) {
		t.Error("an automatic block must not turn a permanent block temporary")
	}
}

func TestLoopbackNeverBlocked(t *testing.T) {
	g, repo := newGuard(t)
	ctx := context.Background()
	if _, err := repo.Insert(ctx, "127.0.0.0/8", ""); err != nil {
		t.Fatal(err)
	}
	if err := g.Reload(ctx); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < FailLimit; i++ {
		_ = g.Fail(ctx, netip.MustParseAddr("127.0.0.1"), time.Now())
	}
	if g.Blocked(netip.MustParseAddr("127.0.0.1"), time.Now()) {
		t.Error("loopback must never be blocked")
	}
}

func TestParsePrefix(t *testing.T) {
	cases := map[string]string{
		"203.0.113.7":      "203.0.113.7/32",
		"10.1.2.3/8":       "10.0.0.0/8",
		"2001:db8::1":      "2001:db8::1/128",
		"::ffff:192.0.2.1": "192.0.2.1/32",
	}
	for in, want := range cases {
		p, err := ParsePrefix(in)
		if err != nil || p.String() != want {
			t.Errorf("ParsePrefix(%q) = %v, %v; want %s", in, p, err, want)
		}
	}
	if _, err := ParsePrefix("not-an-ip"); err == nil {
		t.Error("garbage should not parse")
	}
}
