package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"tera-router/server/internal/connectors"
	"tera-router/server/internal/core"
)

// buddyQuotaPath is the billing meter endpoint. It is not under the chat
// gateway: POST answers Tencent's nested billing payload
// (data.Response.Data.Accounts[]), one entry per credit package.
const buddyQuotaPath = "/v2/billing/meter/get-user-resource"

// buddyBonusPackGap is the smallest distance between a package's cycle end and
// the point its credits stop being spendable for the package to count as a
// recurring cycle. A one-off grant keeps its credits alive past the cycle.
const buddyBonusPackGap = 2 * 24 * time.Hour

// buddyCST is the zone Tencent uses for the wall-clock strings in the billing
// meter. They carry no offset, and treating them as UTC shifts every reset
// countdown by eight hours.
var buddyCST = time.FixedZone("CST", 8*60*60)

// BuddyCreditPackage is one credit package of a buddy account: its name, how
// much of the current cycle is spent, its size, and when the cycle ends.
type BuddyCreditPackage struct {
	Name string `json:"name"`
	// Used and Size are credit units. The vendor reports fractions, so both
	// are floats; the precise variant wins when present.
	Used float64 `json:"used"`
	Size float64 `json:"size"`
	// ResetAt is the cycle end in RFC3339, "" when the package has none.
	ResetAt string `json:"reset_at,omitempty"`
	// Recurring is true for a subscription cycle, false for a one-off grant.
	Recurring bool `json:"recurring"`
}

// buddyPackage is one package as the meter reports it. Tencent sends both a
// plain and a "Precise" (fractional) variant of each capacity field, and the
// plain ones may arrive as JSON numbers or numeric strings, so both go through
// flexFloat.
type buddyPackage struct {
	PackageName           string          `json:"PackageName"`
	SubProductName        string          `json:"SubProductName"`
	CycleStartTime        json.RawMessage `json:"CycleStartTime"`
	CycleEndTime          json.RawMessage `json:"CycleEndTime"`
	DeductionEndTime      json.RawMessage `json:"DeductionEndTime"`
	CycleCapacityUsed     flexFloat       `json:"CycleCapacityUsed"`
	CycleCapacityUsedPrec *flexFloat      `json:"CycleCapacityUsedPrecise"`
	CycleCapacitySize     flexFloat       `json:"CycleCapacitySize"`
	CycleCapacitySizePrec *flexFloat      `json:"CycleCapacitySizePrecise"`
	CapacityUsed          flexFloat       `json:"CapacityUsed"`
	CapacityUsedPrecise   *flexFloat      `json:"CapacityUsedPrecise"`
	CapacitySize          flexFloat       `json:"CapacitySize"`
	CapacitySizePrecise   *flexFloat      `json:"CapacitySizePrecise"`
}

// flexFloat accepts a JSON number or a numeric JSON string. The billing meter
// is inconsistent about which it sends, and a type mismatch would abort the
// whole decode, so the two shapes are normalized at the field boundary.
type flexFloat float64

func (f *flexFloat) UnmarshalJSON(b []byte) error {
	trimmed := strings.TrimSpace(string(b))
	if trimmed == "null" || trimmed == "" {
		*f = 0
		return nil
	}
	if s, ok := strings.CutPrefix(trimmed, `"`); ok {
		s = strings.TrimSuffix(s, `"`)
		trimmed = strings.TrimSpace(s)
		if trimmed == "" {
			*f = 0
			return nil
		}
	}
	v, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return fmt.Errorf("buddy credit value %q: %w", trimmed, err)
	}
	*f = flexFloat(v)
	return nil
}

// buddyQuotaEnvelope is the meter's reply shape.
type buddyQuotaEnvelope struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Response struct {
			Data struct {
				Accounts []buddyPackage `json:"Accounts"`
			} `json:"Data"`
		} `json:"Response"`
	} `json:"data"`
}

// BuddyQuota reads an account's credit packages from the billing meter. The
// slug selects the realm, whose client fingerprint the request presents, and
// baseURL is the account's /v2 gateway root.
func (s *UpstreamService) BuddyQuota(ctx context.Context, baseURL, token, slug string) ([]BuddyCreditPackage, error) {
	if strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("%s: no credential stored", slug)
	}
	endpoint := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if !strings.HasSuffix(endpoint, "/v2") {
		endpoint += "/v2"
	}
	endpoint += "/billing/meter/get-user-resource"
	if err := validateEndpoint(endpoint); err != nil {
		return nil, err
	}

	body, _ := json.Marshal(struct{}{})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	for k, v := range connectors.BuddyHeaders(slug, core.Credentials{AccessToken: token}, nil, "") {
		req.Header.Set(k, v)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := probeClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return nil, fmt.Errorf("%s rejected the credential (HTTP %d)", slug, resp.StatusCode)
	case resp.StatusCode < 200 || resp.StatusCode >= 300:
		return nil, fmt.Errorf("%s billing meter answered HTTP %d", slug, resp.StatusCode)
	}

	var envelope buddyQuotaEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("parse %s quota: %w", slug, err)
	}
	if envelope.Code != 0 {
		return nil, fmt.Errorf("%s quota error: %s", slug, orUnknown(envelope.Msg))
	}
	return ParseBuddyQuota(envelope.Data.Response.Data.Accounts), nil
}

// ParseBuddyQuota splits the credit packages into recurring cycles and one-off
// bonus grants, ordered by expiry. Recurring packages are named by cadence
// (Daily, Weekly, Monthly) with a numeric suffix when a cadence repeats; bonus
// grants are numbered in expiry order.
func ParseBuddyQuota(pkgs []buddyPackage) []BuddyCreditPackage {
	if len(pkgs) == 0 {
		return []BuddyCreditPackage{}
	}
	recurring := make([]buddyPackage, 0, len(pkgs))
	bonus := make([]buddyPackage, 0, len(pkgs))
	for _, p := range pkgs {
		if buddyIsRecurring(p) {
			recurring = append(recurring, p)
		} else {
			bonus = append(bonus, p)
		}
	}
	byExpiry := func(list []buddyPackage) {
		sort.SliceStable(list, func(i, j int) bool {
			return buddyTime(list[i].CycleEndTime).Before(buddyTime(list[j].CycleEndTime))
		})
	}
	byExpiry(recurring)
	byExpiry(bonus)

	out := make([]BuddyCreditPackage, 0, len(pkgs))
	seen := map[string]int{}
	for _, p := range recurring {
		cadence := buddyCadence(p)
		seen[cadence]++
		label := cadence
		if seen[cadence] > 1 {
			label = fmt.Sprintf("%s %d", cadence, seen[cadence])
		}
		out = append(out, buddyPackageEntry(label, p, true))
	}
	for i, p := range bonus {
		out = append(out, buddyPackageEntry(fmt.Sprintf("Bonus pack %d", i+1), p, false))
	}
	return out
}

// buddyPackageEntry converts one package. A recurring package reports its cycle
// capacity; a bonus grant reports its absolute capacity.
func buddyPackageEntry(label string, p buddyPackage, recurring bool) BuddyCreditPackage {
	used, limit := float64(p.CapacityUsed), float64(p.CapacitySize)
	if recurring {
		used, limit = float64(p.CycleCapacityUsed), float64(p.CycleCapacitySize)
		if p.CycleCapacityUsedPrec != nil {
			used = float64(*p.CycleCapacityUsedPrec)
		}
		if p.CycleCapacitySizePrec != nil {
			limit = float64(*p.CycleCapacitySizePrec)
		}
	} else {
		if p.CapacityUsedPrecise != nil {
			used = float64(*p.CapacityUsedPrecise)
		}
		if p.CapacitySizePrecise != nil {
			limit = float64(*p.CapacitySizePrecise)
		}
	}
	return BuddyCreditPackage{
		Name:      label,
		Used:      used,
		Size:      limit,
		ResetAt:   buddyResetAt(p),
		Recurring: recurring,
	}
}

// buddyCadence names a recurring cycle from its length: a ~1-day cycle is
// daily, up to ~10 days is weekly, anything longer is monthly.
func buddyCadence(p buddyPackage) string {
	start, end := buddyTime(p.CycleStartTime), buddyTime(p.CycleEndTime)
	if !start.IsZero() && !end.IsZero() {
		days := end.Sub(start).Hours() / 24
		switch {
		case days <= 1.5:
			return "Daily"
		case days <= 10:
			return "Weekly"
		}
	}
	return "Monthly"
}

// buddyIsRecurring reports whether a package refills on a cycle. The meter
// states the cycle end and the point the credits stop being spendable; a
// package whose credits outlive the cycle by more than buddyBonusPackGap is
// treated as recurring, mirroring the reference gateway's isRefill().
//
// ponytail: this heuristic is unverified against a live account. Check one real
// workbuddy/codebuddy meter reply and flip the comparison here if a one-off
// grant is being labelled a subscription (or the reverse).
func buddyIsRecurring(p buddyPackage) bool {
	end := buddyTime(p.CycleEndTime)
	if end.IsZero() {
		return false
	}
	deduction := buddyTime(p.DeductionEndTime)
	if deduction.IsZero() {
		return true
	}
	return deduction.Sub(end) > buddyBonusPackGap
}

// buddyResetAt returns the package's cycle end as RFC3339, "" when absent.
func buddyResetAt(p buddyPackage) string {
	if t := buddyTime(p.CycleEndTime); !t.IsZero() {
		return t.UTC().Format(time.RFC3339)
	}
	return ""
}

// buddyTime decodes a meter timestamp that may arrive as an RFC3339 string, a
// wall-clock string in the vendor's own zone, a numeric string, or a raw epoch
// in seconds or milliseconds.
func buddyTime(raw json.RawMessage) time.Time {
	if len(raw) == 0 || string(raw) == "null" {
		return time.Time{}
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		s = strings.TrimSpace(s)
		if s == "" {
			return time.Time{}
		}
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			return t
		}
		if t, err := time.ParseInLocation("2006-01-02 15:04:05", s, buddyCST); err == nil {
			return t
		}
	}
	var n float64
	if json.Unmarshal(raw, &n) != nil {
		// A numeric string survived the string branch unparsed; retry it as an
		// epoch rather than dropping the timestamp.
		v, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return time.Time{}
		}
		n = v
	}
	if n <= 0 {
		return time.Time{}
	}
	if n < 1e12 {
		n *= 1000
	}
	return time.UnixMilli(int64(n)).UTC()
}
