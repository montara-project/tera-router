package period

import (
	"testing"
	"time"
)

// TestWindow pins where each budget period starts and when it resets:
// daily at midnight, weekly at midnight between Sunday and Monday (weeks run
// Monday to Sunday), monthly at midnight after the last day of the month.
// The next reset is the start of the following window.
func TestWindow(t *testing.T) {
	at := func(s string) time.Time {
		tm, err := time.ParseInLocation("2006-01-02 15:04", s, time.UTC)
		if err != nil {
			t.Fatal(err)
		}
		return tm
	}
	cases := []struct {
		period, now, start, nextReset, bucket string
	}{
		{"daily", "2026-11-06 11:42", "2026-11-06 00:00", "2026-11-07 00:00", "2026-11-06"},
		{"daily", "2026-11-06 23:59", "2026-11-06 00:00", "2026-11-07 00:00", "2026-11-06"},
		{"daily", "2026-11-07 00:00", "2026-11-07 00:00", "2026-11-08 00:00", "2026-11-07"},
		// Friday, then the last minute of Sunday, then Monday: one week, then the next.
		{"weekly", "2026-11-06 11:42", "2026-11-02 00:00", "2026-11-09 00:00", "2026-11-02"},
		{"weekly", "2026-11-08 23:59", "2026-11-02 00:00", "2026-11-09 00:00", "2026-11-02"},
		{"weekly", "2026-11-09 00:00", "2026-11-09 00:00", "2026-11-16 00:00", "2026-11-09"},
		// A week that crosses a month boundary.
		{"weekly", "2026-12-01 08:00", "2026-11-30 00:00", "2026-12-07 00:00", "2026-11-30"},
		{"monthly", "2026-11-06 11:42", "2026-11-01 00:00", "2026-12-01 00:00", "2026-11"},
		{"monthly", "2026-11-30 23:59", "2026-11-01 00:00", "2026-12-01 00:00", "2026-11"},
		{"monthly", "2027-01-31 12:00", "2027-01-01 00:00", "2027-02-01 00:00", "2027-01"},
		{"monthly", "2028-02-29 12:00", "2028-02-01 00:00", "2028-03-01 00:00", "2028-02"},
		{"monthly", "2026-12-31 23:59", "2026-12-01 00:00", "2027-01-01 00:00", "2026-12"},
	}
	for _, c := range cases {
		bucket, start := Window(c.period, at(c.now))
		if !start.Equal(at(c.start)) || bucket != c.bucket {
			t.Errorf("%s at %s: start %s bucket %s, want %s bucket %s",
				c.period, c.now, start.Format("2006-01-02 15:04"), bucket, c.start, c.bucket)
		}
		// The next reset is when the following window begins.
		_, next := Window(c.period, at(c.nextReset))
		if !next.Equal(at(c.nextReset)) || !at(c.nextReset).After(at(c.now)) {
			t.Errorf("%s at %s: next window starts %s, want %s",
				c.period, c.now, next.Format("2006-01-02 15:04"), c.nextReset)
		}
		if prev, _ := Window(c.period, at(c.nextReset).Add(-time.Minute)); prev != c.bucket {
			t.Errorf("%s: the minute before %s is in bucket %s, want %s", c.period, c.nextReset, prev, c.bucket)
		}
	}
}
