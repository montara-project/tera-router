package ipblock

import (
	"fmt"
	"net/netip"
	"time"

	"tera-router/server/internal/models"
)

const (
	dateLayout = "2006-01-02"
	timeLayout = "15:04"
)

// Restriction is a validated models.RestrictedAccess, ready to check requests
// against. The zero value restricts nothing.
type Restriction struct {
	enabled            bool
	allowed            []netip.Prefix
	loc                *time.Location
	startDate, endDate string
	startTime, endTime string
}

// CompileRestriction validates r and returns it compiled, plus the canonical
// form to store (masked ranges, duplicates dropped).
func CompileRestriction(r models.RestrictedAccess) (Restriction, models.RestrictedAccess, error) {
	for _, d := range []string{r.StartDate, r.EndDate} {
		if _, err := time.Parse(dateLayout, d); d != "" && err != nil {
			return Restriction{}, r, fmt.Errorf("dates must look like 2026-01-31, got %q", d)
		}
	}
	if r.StartDate != "" && r.EndDate != "" && r.EndDate < r.StartDate {
		return Restriction{}, r, fmt.Errorf("end date is before start date")
	}
	for _, t := range []string{r.StartTime, r.EndTime} {
		if _, err := time.Parse(timeLayout, t); t != "" && err != nil {
			return Restriction{}, r, fmt.Errorf("times must look like 22:00, got %q", t)
		}
	}
	if (r.StartTime == "") != (r.EndTime == "") {
		return Restriction{}, r, fmt.Errorf("set both start and end time, or neither")
	}
	if r.StartTime != "" && r.StartTime == r.EndTime {
		return Restriction{}, r, fmt.Errorf("start and end time must differ")
	}
	loc, err := time.LoadLocation(r.Timezone)
	if err != nil {
		return Restriction{}, r, fmt.Errorf("unknown timezone %q", r.Timezone)
	}

	allowed := make([]netip.Prefix, 0, len(r.AllowedIPs))
	canonical := make([]string, 0, len(r.AllowedIPs))
	seen := map[netip.Prefix]bool{}
	for _, s := range r.AllowedIPs {
		p, err := ParsePrefix(s)
		if err != nil {
			return Restriction{}, r, fmt.Errorf("%q is not an IP address or CIDR range", s)
		}
		if seen[p] {
			continue
		}
		seen[p] = true
		allowed = append(allowed, p)
		canonical = append(canonical, p.String())
	}
	r.AllowedIPs = canonical

	return Restriction{
		enabled:   r.Enabled,
		allowed:   allowed,
		loc:       loc,
		startDate: r.StartDate,
		endDate:   r.EndDate,
		startTime: r.StartTime,
		endTime:   r.EndTime,
	}, r, nil
}

// Active reports whether now falls inside the restricted period.
// ponytail: a window past midnight is matched against today's date, so on
// end_date a 22:00–06:00 window stops at 23:59; track the window's start day
// if that edge matters.
func (r Restriction) Active(now time.Time) bool {
	if !r.enabled {
		return false
	}
	t := now.In(r.loc)
	if d := t.Format(dateLayout); (r.startDate != "" && d < r.startDate) || (r.endDate != "" && d > r.endDate) {
		return false
	}
	if r.startTime == "" {
		return true
	}
	hm := t.Format(timeLayout)
	if r.startTime < r.endTime {
		return r.startTime <= hm && hm < r.endTime
	}
	return hm >= r.startTime || hm < r.endTime
}

// Allows reports whether ip is on the allowlist.
func (r Restriction) Allows(ip netip.Addr) bool {
	ip = ip.Unmap()
	for _, p := range r.allowed {
		if p.Contains(ip) {
			return true
		}
	}
	return false
}
