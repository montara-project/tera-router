package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ZCode plan-lane billing readout ("today's balance"), mirroring the
// endpoints zai-org/ZCode builds (zcodePlanBillingCurrentUrl /
// zcodePlanBillingBalanceUrl):
//
//	GET /api/v1/zcode-plan/billing/balance?app_version=&platform=
//	    Plans (definitions) AND balances (usage with the daily window's
//	    period_start/period_end). Requires a UUID X-Device-Mid header or it
//	    answers `3001 parameter error`.
//	GET /api/v1/zcode-plan/billing/current
//	    Plan definitions WITHOUT usage; used as the fallback when balance
//	    fails. Sending the control headers/params that balance needs makes
//	    current return an empty payload, so it gets bare auth only.
//
// Like FetchClaudeUsage, the identity headers are built locally: the billing
// face shares the desktop client's identification set but not the LLM gate
// (no canonical system prompt applies here).
const (
	zcodePlanCurrentPath = "/api/v1/zcode-plan/billing/current"
	zcodePlanBalancePath = "/api/v1/zcode-plan/billing/balance"

	// zcodePlanAppVersion mirrors the app version the LLM identity presents
	// (connectors' zcode identity asset); the billing query carries it too.
	zcodePlanAppVersion = "3.16.3"
)

// zcodePlanOrigin is the plan-lane origin; a var so tests can point it at a
// stub server.
var zcodePlanOrigin = "https://zcode.z.ai"

// ZcodeDeviceMid derives the stable device UUID a ZCode account's billing
// reads are attributed to. The billing endpoints require a UUID-shaped
// X-Device-Mid; the router has no desktop device to present, so a
// deterministic per-account UUID stands in.
func ZcodeDeviceMid(accountID string) string {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte("zcode-device:"+accountID)).String()
}

// ZcodePlanRow is one entitlement's merged grant row. Volatile fields stay
// `any`: the upstream mixes strings and numbers across plan types, and the
// dashboard renders whatever it carries.
type ZcodePlanRow struct {
	Model          string `json:"model"`
	Models         []any  `json:"models"`
	EntitlementID  string `json:"entitlement_id"`
	Plan           string `json:"plan"`
	PlanName       string `json:"plan_name"`
	PlanID         string `json:"plan_id"`
	PlanStatus     any    `json:"plan_status"`
	EndsAt         any    `json:"ends_at"`
	Period         any    `json:"period"`
	PeriodStart    any    `json:"period_start"`
	PeriodEnd      any    `json:"period_end"`
	ExpiresAt      any    `json:"expires_at"`
	Priority       any    `json:"priority"`
	TotalUnits     any    `json:"total_units"`
	UsedUnits      any    `json:"used_units"`
	RemainingUnits any    `json:"remaining_units"`
	AvailableUnits any    `json:"available_units"`
	UnitType       any    `json:"unit_type"`
	Meter          any    `json:"meter"`
}

// ZcodePlanQuota is the merged readout one account's plan lane answers with.
type ZcodePlanQuota struct {
	// Source is "balance" (definitions + usage) or "current" (definitions
	// only — the fallback when the balance endpoint fails).
	Source     string         `json:"source"`
	ServerTime int64          `json:"server_time"`
	Rows       []ZcodePlanRow `json:"rows"`
	Errors     []string       `json:"errors,omitempty"`
}

// FetchZcodePlanQuota reads one account's plan grants: the balance endpoint
// first (definitions + usage), falling back to current (definitions only)
// when it fails. Entitlements defined but absent from the usage list still
// produce a grant-only row.
func FetchZcodePlanQuota(ctx context.Context, accessToken, deviceMid string) (*ZcodePlanQuota, error) {
	if strings.TrimSpace(accessToken) == "" {
		return nil, fmt.Errorf("oauth: no plan token for the billing readout")
	}

	ctl := zcodePlanControlHeaders(accessToken, deviceMid)
	balance := fetchZcodePlanEnvelope(ctx, zcodePlanBalancePath+"?app_version="+zcodePlanAppVersion+"&platform="+runtime.GOOS+"-"+runtime.GOARCH, ctl)
	var plans, balances []any
	var errs []string
	if balance.ok && balance.data != nil {
		plans, _ = balance.data["plans"].([]any)
		balances, _ = balance.data["balances"].([]any)
	} else {
		errs = append(errs, "balance: "+balance.message())
	}

	// The current endpoint answers definitions only, with bare auth — the
	// control face empties its payload.
	source := "balance"
	if len(plans) == 0 {
		current := fetchZcodePlanEnvelope(ctx, zcodePlanCurrentPath, map[string]string{
			"accept":        "application/json",
			"authorization": "Bearer " + accessToken,
		})
		if current.ok && current.data != nil {
			if p, ok := current.data["plans"].([]any); ok && len(p) > 0 {
				plans = p
				source = "current"
			} else {
				errs = append(errs, "current: empty plan list")
			}
		} else {
			errs = append(errs, "current: "+current.message())
		}
	}

	rows := mergeZcodePlanRows(plans, balances)
	serverTime := time.Now().Unix()
	if balance.ok && balance.data != nil {
		if st, ok := balance.data["server_time"].(float64); ok {
			serverTime = int64(st)
		}
	}
	return &ZcodePlanQuota{
		Source:     source,
		ServerTime: serverTime,
		Rows:       rows,
		Errors:     errs,
	}, nil
}

// zcodePlanControlHeaders builds the desktop client's identification set plus
// the device mid the balance endpoint requires. Values mirror the LLM
// identity in connectors/zcode.go — same client, different face.
func zcodePlanControlHeaders(accessToken, deviceMid string) map[string]string {
	h := map[string]string{
		"authorization":       "Bearer " + accessToken,
		"accept":              "application/json",
		"user-agent":          "ZCode/" + zcodePlanAppVersion,
		"http-referer":        "https://zcode.z.ai",
		"x-title":             "Z Code@electron",
		"x-release-channel":   "production",
		"x-client-language":   "en",
		"x-zcode-agent":       "glm",
		"x-platform":          runtime.GOOS + "-" + runtime.GOARCH,
		"x-os-category":       zcodePlanOSCategory(),
		"x-os-version":        "unknown",
		"x-zcode-app-version": zcodePlanAppVersion,
	}
	if deviceMid != "" {
		h["x-device-mid"] = deviceMid
	}
	return h
}

// zcodePlanOSCategory maps the server OS onto the desktop client's categories.
func zcodePlanOSCategory() string {
	switch runtime.GOOS {
	case "darwin":
		return "macos"
	case "windows":
		return "windows"
	default:
		return "linux"
	}
}

// zcodePlanEnvelope is one billing endpoint's outcome.
type zcodePlanEnvelope struct {
	ok     bool
	status int
	data   map[string]any
	msg    string
}

func (e zcodePlanEnvelope) message() string {
	if e.msg != "" {
		return e.msg
	}
	return fmt.Sprintf("status %d", e.status)
}

func fetchZcodePlanEnvelope(ctx context.Context, pathWithQuery string, headers map[string]string) zcodePlanEnvelope {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, zcodePlanOrigin+pathWithQuery, nil)
	if err != nil {
		return zcodePlanEnvelope{msg: fmt.Sprintf("oauth: build billing request: %v", err)}
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	client := &http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return zcodePlanEnvelope{msg: fmt.Sprintf("oauth: billing request: %v", err)}
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	var parsed struct {
		Code any            `json:"code"`
		Msg  string         `json:"msg"`
		Data map[string]any `json:"data"`
	}
	haveBody := json.Unmarshal(body, &parsed) == nil
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		msg := parsed.Msg
		if msg == "" && len(body) > 0 {
			msg = string(body)
			if len(msg) > 160 {
				msg = msg[:160]
			}
		}
		return zcodePlanEnvelope{status: res.StatusCode, msg: msg}
	}
	if haveBody && zcodePlanCodeNonZero(parsed.Code) {
		return zcodePlanEnvelope{status: res.StatusCode, msg: parsed.Msg}
	}
	return zcodePlanEnvelope{ok: true, status: res.StatusCode, data: parsed.Data}
}

func zcodePlanCodeNonZero(code any) bool {
	switch v := code.(type) {
	case float64:
		return v != 0
	case int:
		return v != 0
	default:
		return false
	}
}

// mergeZcodePlanRows produces one row per entitlement, merged from whichever
// endpoint has data; entitlements defined but absent from the usage list
// still show their grant.
func mergeZcodePlanRows(plans, balances []any) []ZcodePlanRow {
	type entMeta struct {
		plan map[string]any
		ent  map[string]any
	}
	entLookup := map[string]entMeta{}
	// entOrder keeps first-seen plan order so grant-only rows come out stable.
	var entOrder []string
	for _, p := range plans {
		pm, ok := p.(map[string]any)
		if !ok {
			continue
		}
		ents, _ := pm["entitlements"].([]any)
		for _, e := range ents {
			em, ok := e.(map[string]any)
			if !ok {
				continue
			}
			id, _ := em["entitlement_id"].(string)
			if id != "" {
				if _, seen := entLookup[id]; !seen {
					entOrder = append(entOrder, id)
				}
				entLookup[id] = entMeta{plan: pm, ent: em}
			}
		}
	}

	var rows []ZcodePlanRow
	inBalances := map[string]bool{}
	for _, b := range balances {
		bm, ok := b.(map[string]any)
		if !ok {
			continue
		}
		id, _ := bm["entitlement_id"].(string)
		inBalances[id] = true
		meta, hasMeta := entLookup[id]
		planID, _ := bm["plan_id"].(string)
		row := ZcodePlanRow{
			Model:         firstNonEmpty(stringOf(bm["show_name"]), zcodeEntShowName(meta)),
			Models:        zcodeCapabilityModels(bm),
			EntitlementID: id,
			Plan:          planID,
			PlanID:        planID,
		}
		if hasMeta {
			row.PlanName = stringOf(meta.plan["name"])
			row.PlanStatus = meta.plan["status"]
			row.EndsAt = meta.plan["ends_at"]
			row.Period = pick(bm["period"], meta.ent["period"])
			row.Priority = pick(bm["priority"], meta.ent["priority"])
			row.TotalUnits = pick(bm["total_units"], meta.ent["grant_units"])
			row.UnitType = pick(bm["unit_type"], meta.ent["unit_type"])
			row.Meter = pick(bm["meter"], meta.ent["meter"])
			// Balance rows usually carry the capability list, but when they
			// don't, the entitlement's grants say which models this row buys.
			if len(row.Models) == 0 {
				row.Models = zcodeCapabilityModels(meta.ent)
			}
		} else {
			row.Period = bm["period"]
			row.Priority = bm["priority"]
			row.TotalUnits = bm["total_units"]
			row.UnitType = bm["unit_type"]
			row.Meter = bm["meter"]
		}
		row.PeriodStart = finite(bm["period_start"])
		row.PeriodEnd = finite(bm["period_end"])
		row.ExpiresAt = finite(bm["expires_at"])
		row.UsedUnits = finite(bm["used_units"])
		row.RemainingUnits = finite(bm["remaining_units"])
		row.AvailableUnits = finite(bm["available_units"])
		rows = append(rows, row)
	}
	// Entitlements defined but missing from the usage list: show the grant.
	for _, id := range entOrder {
		if inBalances[id] {
			continue
		}
		m := entLookup[id]
		planID, _ := m.plan["plan_id"].(string)
		rows = append(rows, ZcodePlanRow{
			Model:         stringOf(m.ent["show_name"]),
			Models:        zcodeCapabilityModels(m.ent),
			EntitlementID: id,
			Plan:          planID,
			PlanName:      stringOf(m.plan["name"]),
			PlanID:        planID,
			PlanStatus:    m.plan["status"],
			EndsAt:        m.plan["ends_at"],
			Period:        m.ent["period"],
			Priority:      pick(m.ent["priority"], m.plan["priority"]),
			TotalUnits:    m.ent["grant_units"],
			UnitType:      m.ent["unit_type"],
			Meter:         m.ent["meter"],
		})
	}
	return rows
}

// zcodeCapabilityModels extracts the "model:<id>" entries of a row's
// capabilities list — the models the entitlement grants.
func zcodeCapabilityModels(row map[string]any) []any {
	caps, _ := row["capabilities"].([]any)
	out := make([]any, 0, len(caps))
	for _, c := range caps {
		if s, ok := c.(string); ok && strings.HasPrefix(s, "model:") {
			out = append(out, strings.TrimPrefix(s, "model:"))
		}
	}
	return out
}

// finite mirrors Number.isFinite for the JSON numbers the lane sends; a
// non-number (or NaN) becomes nil so the dashboard renders a dash.
func finite(v any) any {
	if f, ok := v.(float64); ok && f == f {
		return f
	}
	return nil
}

func pick(preferred, fallback any) any {
	if preferred != nil {
		return preferred
	}
	return fallback
}

func zcodeEntShowName(m struct {
	plan map[string]any
	ent  map[string]any
}) string {
	if m.ent == nil {
		return ""
	}
	return stringOf(m.ent["show_name"])
}

func stringOf(v any) string {
	s, _ := v.(string)
	return s
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
