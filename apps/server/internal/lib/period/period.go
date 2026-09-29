// Package period resolves budget/plan period windows. Both the dashboard
// budget endpoints and the inference gateway's budget guard need to agree on
// where the current daily/weekly/monthly window starts, so the rule lives
// here rather than in either caller.
package period

import "time"

// Window resolves the current period bucket and window start for a budget
// period ("daily", "weekly", "monthly"; anything else is monthly).
//
// The bucket is the value persisted in budgets.period_bucket so a rollover
// can be detected by comparing it with a freshly computed one. It is the
// window's start date (YYYY-MM-DD) for daily/weekly periods and the month
// (YYYY-MM) for monthly ones.
func Window(period string, now time.Time) (bucket string, from time.Time) {
	switch period {
	case "daily":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		return start.Format("2006-01-02"), start
	case "weekly":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, now.Location())
		return start.Format("2006-01-02"), start
	default: // monthly
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		return start.Format("2006-01"), start
	}
}
