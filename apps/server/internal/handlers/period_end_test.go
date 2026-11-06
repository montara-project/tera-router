package handlers

import (
	"testing"
	"time"

	"tera-router/server/internal/lib/period"
)

// TestPeriodEndIsNextWindow pins that the "resets at" shown for a budget is
// exactly when period.Window starts the next window: next midnight, the
// Monday 00:00 after Sunday, and the 1st of next month at 00:00.
func TestPeriodEndIsNextWindow(t *testing.T) {
	for _, p := range []string{"daily", "weekly", "monthly"} {
		for _, now := range []time.Time{
			time.Date(2026, 11, 6, 11, 42, 0, 0, time.UTC),
			time.Date(2026, 11, 8, 23, 59, 0, 0, time.UTC),
			time.Date(2026, 12, 31, 23, 59, 0, 0, time.UTC),
			time.Date(2028, 2, 29, 12, 0, 0, 0, time.UTC),
		} {
			bucket, from := period.Window(p, now)
			end := periodEnd(p, from)
			if _, next := period.Window(p, end); !next.Equal(end) || !end.After(now) {
				t.Errorf("%s at %s: resets %s, but the next window starts %s", p, now, end, next)
			}
			if last, _ := period.Window(p, end.Add(-time.Nanosecond)); last != bucket {
				t.Errorf("%s at %s: the instant before %s is already a new window", p, now, end)
			}
		}
	}
}
