package repositories_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"tera-router/server/internal/config"
	"tera-router/server/internal/database"
	"tera-router/server/internal/migrator"
	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"
)

// newUsageRepo opens a migrated temporary database and returns a usage
// repository over it.
func newUsageRepo(t *testing.T) *repositories.UsageRepository {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "usage_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return repositories.New(db, &config.ConfigApp{}).Usage
}

// insert writes one usage row.
func insert(t *testing.T, repo *repositories.UsageRepository, u models.UsageRecord) {
	t.Helper()
	if u.CreatedAt.IsZero() {
		u.CreatedAt = time.Now()
	}
	if err := repo.Insert(context.Background(), u); err != nil {
		t.Fatalf("insert usage: %v", err)
	}
}

func TestUsageTrafficSplitsFailuresAndTokenClasses(t *testing.T) {
	repo := newUsageRepo(t)
	from := time.Now().Add(-time.Hour)

	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "gpt-x", PromptTokens: 100, CompletionTokens: 20,
		CachedTokens: 30, CacheWriteTokens: 10, ReasoningTokens: 5, CacheHit: true, CostMicros: 7,
	})
	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "gpt-x", PromptTokens: 50, CompletionTokens: 5, CostMicros: 3,
	})
	insert(t, repo, models.UsageRecord{
		Provider: "anthropic", Model: "claude", Failed: true, ErrorKind: "upstream",
	})
	// Outside the window: must not be counted.
	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "gpt-x", PromptTokens: 999, CreatedAt: from.Add(-time.Hour),
	})

	traffic, err := repo.Traffic(context.Background(), from, time.Now().Add(time.Minute))
	if err != nil {
		t.Fatalf("traffic: %v", err)
	}
	if traffic.Requests != 3 || traffic.Failed != 1 {
		t.Errorf("requests/failed = %d/%d, want 3/1", traffic.Requests, traffic.Failed)
	}
	if traffic.PromptTokens != 150 || traffic.CompletionTokens != 25 {
		t.Errorf("tokens = %d/%d, want 150/25", traffic.PromptTokens, traffic.CompletionTokens)
	}
	if traffic.CachedTokens != 30 || traffic.CacheWriteTokens != 10 || traffic.ReasoningTokens != 5 {
		t.Errorf("token classes = %d/%d/%d", traffic.CachedTokens, traffic.CacheWriteTokens, traffic.ReasoningTokens)
	}
	if traffic.CacheHits != 1 {
		t.Errorf("cache hits = %d, want 1", traffic.CacheHits)
	}
}

func TestUsagePerformanceExcludesFailedAttempts(t *testing.T) {
	repo := newUsageRepo(t)
	from := time.Now().Add(-time.Hour)

	insert(t, repo, models.UsageRecord{Provider: "openai", Model: "m", LatencyMS: 100, TTFTMS: 40})
	insert(t, repo, models.UsageRecord{Provider: "openai", Model: "m", LatencyMS: 300, TTFTMS: 60})
	// A failed attempt carries no completion latency and must not drag the
	// average toward zero.
	insert(t, repo, models.UsageRecord{Provider: "openai", Model: "m", Failed: true, LatencyMS: 0})

	perf, err := repo.Performance(context.Background(), from)
	if err != nil {
		t.Fatalf("performance: %v", err)
	}
	if perf.Requests != 2 {
		t.Errorf("sampled requests = %d, want 2", perf.Requests)
	}
	if perf.AvgMS != 200 {
		t.Errorf("avg latency = %d, want 200", perf.AvgMS)
	}
	// TTFT averages only over rows that recorded it.
	if perf.TTFTMS != 50 || perf.TTFTSamples != 2 {
		t.Errorf("ttft = %d over %d samples, want 50 over 2", perf.TTFTMS, perf.TTFTSamples)
	}
}

func TestUsageByProviderGroupsAndOrders(t *testing.T) {
	repo := newUsageRepo(t)
	from := time.Now().Add(-time.Hour)

	insert(t, repo, models.UsageRecord{Provider: "openai", Model: "a", PromptTokens: 10, CostMicros: 5})
	insert(t, repo, models.UsageRecord{Provider: "openai", Model: "b", PromptTokens: 20, CostMicros: 5})
	insert(t, repo, models.UsageRecord{Provider: "anthropic", Model: "c", PromptTokens: 30, CostMicros: 1})

	groups, err := repo.ByProvider(context.Background(), from)
	if err != nil {
		t.Fatalf("by provider: %v", err)
	}
	if len(groups) != 2 {
		t.Fatalf("groups = %d, want 2", len(groups))
	}
	if groups[0].Provider != "openai" || groups[0].Requests != 2 || groups[0].PromptTokens != 30 {
		t.Errorf("first group = %+v, want openai/2/30", groups[0])
	}
}

func TestUsageRecentReturnsNewestFirstAndHonoursLimit(t *testing.T) {
	repo := newUsageRepo(t)
	base := time.Now().Add(-time.Hour)

	for i := range 5 {
		insert(t, repo, models.UsageRecord{
			Provider: "openai", Model: "m", PromptTokens: i,
			CreatedAt: base.Add(time.Duration(i) * time.Minute),
		})
	}

	rows, err := repo.Recent(context.Background(), 3)
	if err != nil {
		t.Fatalf("recent: %v", err)
	}
	if len(rows) != 3 {
		t.Fatalf("rows = %d, want 3", len(rows))
	}
	if rows[0].PromptTokens != 4 {
		t.Errorf("newest first: got prompt_tokens %d, want 4", rows[0].PromptTokens)
	}
	if rows[0].CreatedAt.Before(rows[1].CreatedAt) {
		t.Errorf("rows are not newest-first: %v then %v", rows[0].CreatedAt, rows[1].CreatedAt)
	}
}

func TestUsageDailyWithFailuresBucketsByDay(t *testing.T) {
	repo := newUsageRepo(t)
	now := time.Now()
	from := now.Add(-72 * time.Hour)

	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "m", PromptTokens: 10, CompletionTokens: 5,
		CostMicros: 2, CreatedAt: now,
	})
	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "m", Failed: true, CreatedAt: now,
	})
	insert(t, repo, models.UsageRecord{
		Provider: "openai", Model: "m", PromptTokens: 1, CreatedAt: now.Add(-25 * time.Hour),
	})

	days, err := repo.DailyWithFailures(context.Background(), from, false)
	if err != nil {
		t.Fatalf("daily: %v", err)
	}
	if len(days) != 2 {
		t.Fatalf("days = %d, want 2", len(days))
	}
	today := days[len(days)-1]
	if today.Day != now.Format("2006-01-02") {
		t.Errorf("bucket = %s, want %s", today.Day, now.Format("2006-01-02"))
	}
	if today.Requests != 2 || today.Failed != 1 || today.Tokens != 15 || today.CostMicros != 2 {
		t.Errorf("today = %+v, want 2 requests / 1 failed / 15 tokens / 2 micros", today)
	}
}

func TestUsageByModelGroupedSeparatesModels(t *testing.T) {
	repo := newUsageRepo(t)
	from := time.Now().Add(-time.Hour)

	insert(t, repo, models.UsageRecord{Provider: "openai", Model: "a", PromptTokens: 10, LatencyMS: 100})
	insert(t, repo, models.UsageRecord{Provider: "openai", Model: "a", PromptTokens: 10, LatencyMS: 300})
	insert(t, repo, models.UsageRecord{Provider: "openai", Model: "b", PromptTokens: 10})

	groups, err := repo.ByModelGrouped(context.Background(), from)
	if err != nil {
		t.Fatalf("by model: %v", err)
	}
	if len(groups) != 2 {
		t.Fatalf("groups = %d, want 2", len(groups))
	}
	if groups[0].Model != "a" || groups[0].Requests != 2 || groups[0].AvgLatencyMS != 200 {
		t.Errorf("first group = %+v, want a/2/200", groups[0])
	}
}

func TestUsageTrafficWindowAndTokenSaving(t *testing.T) {
	repo := newUsageRepo(t)
	now := time.Now()
	from, to := now.Add(-time.Hour), now.Add(time.Minute)

	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", PromptReducedBytes: 40, OutputShaped: true, CostMicros: 5})
	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", OutputShaped: true})
	// A failed attempt carries the same saving but must not be counted twice.
	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", PromptReducedBytes: 40, OutputShaped: true, Failed: true})
	// At or after `to`: outside the window.
	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", PromptReducedBytes: 99, CreatedAt: to})

	traffic, err := repo.Traffic(context.Background(), from, to)
	if err != nil {
		t.Fatalf("traffic: %v", err)
	}
	if traffic.Requests != 3 || traffic.CostMicros != 5 {
		t.Errorf("requests/cost = %d/%d, want 3/5", traffic.Requests, traffic.CostMicros)
	}
	if traffic.PromptReducedBytes != 40 || traffic.CompressedRequests != 1 || traffic.ShapedRequests != 2 {
		t.Errorf("saving = %d bytes / %d compressed / %d shaped, want 40/1/2",
			traffic.PromptReducedBytes, traffic.CompressedRequests, traffic.ShapedRequests)
	}
}

func TestUsageLatenciesSortedSuccessOnly(t *testing.T) {
	repo := newUsageRepo(t)
	now := time.Now()

	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", LatencyMS: 300})
	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", LatencyMS: 100})
	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", LatencyMS: 9000, Failed: true})

	got, err := repo.Latencies(context.Background(), now.Add(-time.Hour), now.Add(time.Minute))
	if err != nil {
		t.Fatalf("latencies: %v", err)
	}
	if len(got) != 2 || got[0] != 100 || got[1] != 300 {
		t.Errorf("latencies = %v, want [100 300]", got)
	}
}

func TestUsageDailyWithFailuresHourlyBuckets(t *testing.T) {
	repo := newUsageRepo(t)
	now := time.Now().UTC().Truncate(time.Hour).Add(30 * time.Minute)

	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", LatencyMS: 100, CreatedAt: now})
	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", LatencyMS: 300, CreatedAt: now})
	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", LatencyMS: 5000, Failed: true, CreatedAt: now})
	insert(t, repo, models.UsageRecord{Provider: "p", Model: "m", CreatedAt: now.Add(-time.Hour)})

	buckets, err := repo.DailyWithFailures(context.Background(), now.Add(-3*time.Hour), true)
	if err != nil {
		t.Fatalf("hourly: %v", err)
	}
	if len(buckets) != 2 {
		t.Fatalf("buckets = %d, want 2", len(buckets))
	}
	last := buckets[1]
	if last.Day != now.Format("2006-01-02 15:00") {
		t.Errorf("bucket = %q, want %q", last.Day, now.Format("2006-01-02 15:00"))
	}
	// Failed attempts are left out of the latency average.
	if last.Requests != 3 || last.Failed != 1 || last.LatencyMS != 200 {
		t.Errorf("last = %+v, want 3 requests / 1 failed / 200 ms", last)
	}
}
