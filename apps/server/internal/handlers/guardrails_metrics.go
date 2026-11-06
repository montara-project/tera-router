package handlers

import (
	"encoding/json"
	"sort"
	"strings"
	"time"

	"tera-router/server/internal/dtos"
	"tera-router/server/internal/repositories"

	"github.com/gofiber/fiber/v3"
)

// guardrailPanelRows is how many rows a breakdown panel lists.
const guardrailPanelRows = 5

// guardrailDetectorLabels names the detectors the gateway records on a
// decision.
var guardrailDetectorLabels = map[string]string{
	"pii":       "PII",
	"injection": "Prompt injection",
	"topics":    "Topics",
	"toxicity":  "Toxicity",
	"bias":      "Bias",
}

// guardrailDetail is the JSON the gateway stores on a decision's audit row.
type guardrailDetail struct {
	Detectors  []string `json:"detectors"`
	Entities   []string `json:"entities"`
	Reasons    []string `json:"reasons"`
	OverheadMS int64    `json:"overhead_ms"`
	KeyID      string   `json:"key_id"`
}

// Metrics returns the guardrails overview over one range (today, 24h, 7d,
// 30d, 90d; default 24h): the decision counts, the actions series, and the
// detector, reason, API key, model and entity breakdowns. Every request is
// screened before an upstream sees it, so Checked also counts the requests
// the guardrails blocked before they were metered.
func (h *guardrailsHandler) Metrics(c fiber.Ctx) error {
	rng := c.Query("range", "24h")
	hourly := rng == "today" || rng == "24h"
	from := rangeStart(rng)
	now := time.Now()

	rows, err := h.app.Repos.Guardrails.DecisionRows(c.Context(), from, now.Add(time.Minute))
	if err != nil {
		return err
	}
	requests, err := h.app.Repos.Usage.CountSince(c.Context(), from)
	if err != nil {
		return err
	}

	folded := foldDecisions(rows, hourly)
	// Every decision row is a request that was screened, and a blocked request
	// never reaches the usage table. That makes metered + blocked the checked
	// count; the decision total is the floor when usage rows are missing.
	checked := requests + folded.blocked
	if decisions := folded.blocked + folded.masked + folded.warned + folded.logged; decisions > checked {
		checked = decisions
	}
	out := dtos.GuardrailMetrics{
		Range:     rng,
		Hourly:    hourly,
		Checked:   checked,
		Blocked:   folded.blocked,
		Masked:    folded.masked,
		Warned:    folded.warned,
		Logged:    folded.logged,
		Overhead:  overheadStat(folded.overhead),
		Series:    filledSeries(folded.series, from, now, hourly),
		Detectors: sortedGroups(folded.detectors),
		Reasons:   sortedCounts(folded.reasons),
		Keys:      sortedGroups(folded.keys),
		Models:    sortedGroups(folded.models),
		Entities:  sortedCounts(folded.entities),
	}
	return dtos.OK(c, out)
}

// aggregate folds the window's decisions into the overview panels.
type aggregate struct {
	blocked   int64
	masked    int64
	warned    int64
	logged    int64
	series    map[string]*dtos.GuardrailMetricPoint
	detectors map[string]*dtos.GuardrailMetricGroup
	reasons   map[string]int64
	keys      map[string]*dtos.GuardrailMetricGroup
	models    map[string]*dtos.GuardrailMetricGroup
	entities  map[string]int64
	overhead  []int
}

// foldDecisions walks the window's audit rows once, appending to every panel.
func foldDecisions(rows []repositories.GuardrailDecisionRow, hourly bool) aggregate {
	out := aggregate{
		series:    map[string]*dtos.GuardrailMetricPoint{},
		detectors: map[string]*dtos.GuardrailMetricGroup{},
		reasons:   map[string]int64{},
		keys:      map[string]*dtos.GuardrailMetricGroup{},
		models:    map[string]*dtos.GuardrailMetricGroup{},
		entities:  map[string]int64{},
	}

	step, layout := 24*time.Hour, time.DateOnly
	if hourly {
		step, layout = time.Hour, "2006-01-02 15:00"
	}

	for _, row := range rows {
		var detail guardrailDetail
		_ = json.Unmarshal([]byte(row.Detail), &detail)

		kind := strings.TrimPrefix(row.Action, "guardrail.")
		switch kind {
		case "block":
			out.blocked++
		case "warn":
			out.warned++
		case "log":
			out.logged++
		case "redact", "mask", "hash":
			out.masked++
		default:
			continue
		}

		bucket := row.CreatedAt.UTC().Truncate(step).Format(layout)
		point := out.series[bucket]
		if point == nil {
			point = &dtos.GuardrailMetricPoint{}
			out.series[bucket] = point
		}
		addKind(&point.Blocked, &point.Masked, &point.Warned, &point.Logged, kind)

		for _, key := range detail.Detectors {
			label, known := guardrailDetectorLabels[key]
			if !known {
				label = key
			}
			addGroup(out.detectors, key, label, kind)
		}
		if detail.KeyID != "" {
			addGroup(out.keys, detail.KeyID, strings.TrimPrefix(row.Actor, "key:"), kind)
		}
		if row.Target != "" {
			addGroup(out.models, row.Target, row.Target, kind)
		}
		for _, reason := range detail.Reasons {
			out.reasons[reason]++
		}
		for _, entity := range detail.Entities {
			out.entities[entity]++
		}
		if detail.OverheadMS > 0 {
			out.overhead = append(out.overhead, int(detail.OverheadMS))
		}
	}
	return out
}

// addKind credits one decision to the counters of a series point or a
// breakdown row.
func addKind(blocked, masked, warned, logged *int64, kind string) {
	switch kind {
	case "block":
		*blocked++
	case "warn":
		*warned++
	case "log":
		*logged++
	default:
		*masked++
	}
}

// addGroup credits one decision to a breakdown row, creating it on first
// sight.
func addGroup(groups map[string]*dtos.GuardrailMetricGroup, key, label, kind string) {
	group := groups[key]
	if group == nil {
		group = &dtos.GuardrailMetricGroup{Key: key, Label: label}
		groups[key] = group
	}
	addKind(&group.Blocked, &group.Masked, &group.Warned, &group.Logged, kind)
}

// filledSeries renders every bucket of the window, so the chart keeps its
// intervals when nothing happened.
func filledSeries(buckets map[string]*dtos.GuardrailMetricPoint, from, now time.Time, hourly bool) []dtos.GuardrailMetricPoint {
	step, layout := 24*time.Hour, time.DateOnly
	start := from.UTC().Truncate(24 * time.Hour)
	if hourly {
		step, layout = time.Hour, "2006-01-02 15:00"
		start = from.UTC().Truncate(time.Hour)
	}

	out := []dtos.GuardrailMetricPoint{}
	for t := start; !t.After(now.UTC()); t = t.Add(step) {
		key := t.Format(layout)
		point := dtos.GuardrailMetricPoint{Bucket: bucketLabel(key, hourly)}
		if found, ok := buckets[key]; ok {
			point.Blocked, point.Masked, point.Warned, point.Logged =
				found.Blocked, found.Masked, found.Warned, found.Logged
		}
		out = append(out, point)
	}
	return out
}

// sortedGroups ranks a breakdown by blocked, then masked, then total, and
// trims it to the panel's row count.
func sortedGroups(groups map[string]*dtos.GuardrailMetricGroup) []dtos.GuardrailMetricGroup {
	out := make([]dtos.GuardrailMetricGroup, 0, len(groups))
	for _, group := range groups {
		out = append(out, *group)
	}
	sort.Slice(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.Blocked != b.Blocked {
			return a.Blocked > b.Blocked
		}
		if a.Masked != b.Masked {
			return a.Masked > b.Masked
		}
		if decisionTotal(a) != decisionTotal(b) {
			return decisionTotal(a) > decisionTotal(b)
		}
		return a.Label < b.Label
	})
	if len(out) > guardrailPanelRows {
		out = out[:guardrailPanelRows]
	}
	return out
}

// sortedCounts ranks a counter panel by count, then name.
func sortedCounts(counts map[string]int64) []dtos.GuardrailMetricCount {
	out := make([]dtos.GuardrailMetricCount, 0, len(counts))
	for key, count := range counts {
		out = append(out, dtos.GuardrailMetricCount{Key: key, Count: count})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Key < out[j].Key
	})
	if len(out) > guardrailPanelRows {
		out = out[:guardrailPanelRows]
	}
	return out
}

// decisionTotal is a breakdown row's decision count across every kind.
func decisionTotal(group dtos.GuardrailMetricGroup) int64 {
	return group.Blocked + group.Masked + group.Warned + group.Logged
}

// overheadStat summarises the recorded screen durations. Samples stays 0 until
// a decision records one, which the dashboard reports as not measured.
func overheadStat(samples []int) dtos.GuardrailOverhead {
	if len(samples) == 0 {
		return dtos.GuardrailOverhead{}
	}
	sum := 0
	for _, ms := range samples {
		sum += ms
	}
	return dtos.GuardrailOverhead{
		Samples: int64(len(samples)),
		P50:     int64(percentile(samples, 0.5)),
		P95:     int64(percentile(samples, 0.95)),
		Avg:     int64(sum / len(samples)),
	}
}
