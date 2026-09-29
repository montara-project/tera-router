// Package guardrails implements the native content-safety detectors behind
// the guardrails policies: PII masking, prompt-injection patterns, topic
// boundaries, and toxicity/bias keyword catalogs. The engine is
// deterministic and dependency-free; external engines (Presidio sidecar,
// OpenAI moderation) fall back to these detectors when unavailable or when
// external engines are disabled tenant-wide.
package guardrails

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// PiiConfig mirrors the dashboard PII detector options.
type PiiConfig struct {
	Enabled         bool     `json:"enabled"`
	Entities        []string `json:"entities"`
	MaskingStrategy string   `json:"masking_strategy"`
	MinConfidence   float64  `json:"min_confidence"`
	Engine          string   `json:"engine"`
	ScanOutput      bool     `json:"scan_output"`
}

// InjectionConfig mirrors the prompt-injection detector options.
type InjectionConfig struct {
	Enabled  bool   `json:"enabled"`
	Severity string `json:"severity"`
	Action   string `json:"action"`
}

// TopicsConfig mirrors the topic-boundary detector options.
type TopicsConfig struct {
	Enabled bool     `json:"enabled"`
	Mode    string   `json:"mode"`
	Topics  []string `json:"topics"`
	Action  string   `json:"action"`
	Engine  string   `json:"engine"`
}

// ToxicityConfig mirrors the toxicity detector options.
type ToxicityConfig struct {
	Enabled    bool     `json:"enabled"`
	Categories []string `json:"categories"`
	Threshold  int      `json:"threshold"`
	Action     string   `json:"action"`
	Engine     string   `json:"engine"`
}

// BiasConfig mirrors the bias detector options.
type BiasConfig struct {
	Enabled    bool     `json:"enabled"`
	Categories []string `json:"categories"`
	Threshold  int      `json:"threshold"`
	Action     string   `json:"action"`
}

// Config is the full detector configuration stored on a policy.
type Config struct {
	Pii       PiiConfig       `json:"pii"`
	Injection InjectionConfig `json:"injection"`
	Topics    TopicsConfig    `json:"topics"`
	Toxicity  ToxicityConfig  `json:"toxicity"`
	Bias      BiasConfig      `json:"bias"`
}

// ParseConfig decodes a stored config document, filling dashboard defaults
// for absent fields.
func ParseConfig(raw string) Config {
	cfg := Config{
		Pii:       PiiConfig{MaskingStrategy: "redact", MinConfidence: 0.5, Engine: "native"},
		Injection: InjectionConfig{Severity: "high", Action: "block"},
		Topics:    TopicsConfig{Mode: "block", Action: "warn", Engine: "keyword"},
		Toxicity:  ToxicityConfig{Threshold: 60, Action: "warn", Engine: "native"},
		Bias:      BiasConfig{Threshold: 60, Action: "log"},
	}
	if strings.TrimSpace(raw) == "" {
		return cfg
	}
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return Config{
			Pii:       PiiConfig{MaskingStrategy: "redact", MinConfidence: 0.5, Engine: "native"},
			Injection: InjectionConfig{Severity: "high", Action: "block"},
			Topics:    TopicsConfig{Mode: "block", Action: "warn", Engine: "keyword"},
			Toxicity:  ToxicityConfig{Threshold: 60, Action: "warn", Engine: "native"},
			Bias:      BiasConfig{Threshold: 60, Action: "log"},
		}
	}
	return cfg
}

// Match is one detector hit rendered in the dashboard.
type Match struct {
	Entity string `json:"entity"`
	Value  string `json:"value"`
	Start  int    `json:"start"`
	End    int    `json:"end"`
}

// DetectorResult is the outcome of one detector against the sample text.
type DetectorResult struct {
	Key     string  `json:"key"`
	Label   string  `json:"label"`
	Enabled bool    `json:"enabled"`
	Action  string  `json:"action"`
	Engine  string  `json:"engine"`
	Note    string  `json:"note,omitempty"`
	Matches []Match `json:"matches"`
}

// Result is the full evaluation outcome: the strongest triggered action, the
// text after PII masking, and every detector outcome.
type Result struct {
	Decision   string           `json:"decision"`
	MaskedText string           `json:"masked_text"`
	Detectors  []DetectorResult `json:"detectors"`
}

type piiPattern struct {
	entity string
	re     *regexp.Regexp
}

var piiPatterns = []piiPattern{
	{"EMAIL_ADDRESS", regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`)},
	{"ID_NIK", regexp.MustCompile(`\b\d{16}\b`)},
	{"ID_NPWP", regexp.MustCompile(`\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b`)},
	{"ID_PASSPORT", regexp.MustCompile(`\b[A-Z]{2}\d{6,7}\b`)},
	{"CREDIT_CARD", regexp.MustCompile(`\b(?:\d[ -]*?){13,16}\b`)},
	{"IBAN_CODE", regexp.MustCompile(`\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b`)},
	{"IP_ADDRESS", regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)},
	{"PHONE_NUMBER", regexp.MustCompile(`(?:\+62|62|0)8\d{7,11}\b`)},
	{"URL", regexp.MustCompile(`https?://[^\s]+`)},
	{"PERSON", regexp.MustCompile(`\b(?:Pak|Bu|Bapak|Ibu|Sdr\.|Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+\b`)},
}

// injectionTiers lists prompt-injection patterns from strongest (tier 1,
// always counted at any severity) to weakest (tier 3, only at low severity).
var injectionTiers = [][]*regexp.Regexp{
	{
		regexp.MustCompile(`(?i)ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+instructions`),
		regexp.MustCompile(`(?i)disregard\s+(all\s+|the\s+)?(previous|prior|above)\s+(instructions|prompts)`),
		regexp.MustCompile(`(?i)reveal\s+(your\s+)?(system\s+)?(instructions|prompt)`),
		regexp.MustCompile(`(?i)repeat\s+(your\s+)?(system\s+)?(instructions|prompt)`),
		regexp.MustCompile(`(?i)\bDAN\b.*\bjailbreak\b|\bjailbreak\b.*\bDAN\b`),
	},
	{
		regexp.MustCompile(`(?i)you\s+are\s+now\s+(a|an|no longer)`),
		regexp.MustCompile(`(?i)act\s+as\s+(if\s+)?(you\s+)?(were|is)\s+unfiltered`),
		regexp.MustCompile(`(?i)developer\s+mode`),
		regexp.MustCompile(`(?i)prompt\s+leak`),
		regexp.MustCompile(`(?i)ignore\s+(the\s+)?above`),
	},
	{
		regexp.MustCompile(`(?i)roleplay\s+as\s+(an?\s+)?(unfiltered|uncensored)`),
		regexp.MustCompile(`(?i)pretend\s+(you\s+)?(have\s+)?no\s+restrictions`),
		regexp.MustCompile(`(?i)do\s+not\s+follow\s+(your\s+)?(rules|guidelines)`),
	},
}

var toxicityCatalog = map[string][]string{
	"profanity":   {"anjing", "bangsat", "tai", "fuck", "shit", "bitch", "damn"},
	"hate speech": {"benci", "penjajah", "hate", "supremaci", "kafir"},
	"harassment":  {"bodoh", "idiot", "hina", "bully", "stupid", "loser", "insult"},
	"violence":    {"bunuh", "pukul", "tembak", "kill", "murder", "attack", "beat"},
	"sexual":      {"porn", "seks", "telanjang", "nude", "erotik", "erotic"},
}

var biasCatalog = map[string][]string{
	"political": {"politik", "presiden", "gubernur", "pemilu", "partai", "election", "liberal", "konservatif"},
	"gender":    {"wanita tidak", "perempuan tidak", "gender", "feminis", "maskulin", "patriarki"},
	"ethnic":    {"suku", "etnis", "pribumi", "pendatang", "ethnic", "race"},
	"religious": {"agama", "muslim", "kristen", "hindu", "budha", "religion", "iman"},
}

func containsFold(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}

// Evaluate runs every enabled detector in cfg over text. When
// externalDetectors is false, external engine selections fall back to the
// native detectors with an explanatory note.
func Evaluate(cfg Config, externalDetectors bool, text string) Result {
	result := Result{Decision: "allow", MaskedText: text}

	// Resolve the effective engine, honouring the tenant-wide external
	// detectors toggle.
	piiEngine, piiNote := resolveEngine(cfg.Pii.Engine, externalDetectors, "Presidio")
	toxEngine, toxNote := resolveEngine(cfg.Toxicity.Engine, externalDetectors, "OpenAI moderation")
	topEngine, topNote := resolveEngine(cfg.Topics.Engine, externalDetectors, "embeddings")

	// PII detection + masking.
	piiAction := piiActionLabel(cfg.Pii.MaskingStrategy)
	piiMatches := []Match{}
	if cfg.Pii.Enabled {
		selected := map[string]bool{}
		for _, entity := range cfg.Pii.Entities {
			selected[strings.ToLower(entity)] = true
		}
		useAll := len(selected) == 0
		for _, pattern := range piiPatterns {
			if !useAll && !selected[strings.ToLower(pattern.entity)] {
				continue
			}
			for _, loc := range pattern.re.FindAllStringIndex(text, -1) {
				piiMatches = append(piiMatches, Match{
					Entity: pattern.entity,
					Value:  text[loc[0]:loc[1]],
					Start:  loc[0],
					End:    loc[1],
				})
			}
		}
		result.MaskedText = maskText(text, dedupePIIMatches(piiMatches), cfg.Pii.MaskingStrategy)
	}
	result.Detectors = append(result.Detectors, DetectorResult{
		Key: "pii", Label: "PII Detection", Enabled: cfg.Pii.Enabled,
		Action: piiAction, Engine: piiEngine, Note: piiNote, Matches: dedupePIIMatches(piiMatches),
	})
	if len(piiMatches) > 0 {
		result.Decision = strongest(result.Decision, piiAction)
	}

	// Prompt injection.
	injMatches := []Match{}
	if cfg.Injection.Enabled {
		tiers := 1
		switch strings.ToLower(cfg.Injection.Severity) {
		case "low":
			tiers = 3
		case "medium":
			tiers = 2
		}
		for tier := 0; tier < tiers && tier < len(injectionTiers); tier++ {
			for _, re := range injectionTiers[tier] {
				for _, loc := range re.FindAllStringIndex(text, -1) {
					injMatches = append(injMatches, Match{
						Entity: "injection_pattern",
						Value:  text[loc[0]:loc[1]],
						Start:  loc[0],
						End:    loc[1],
					})
				}
			}
		}
	}
	result.Detectors = append(result.Detectors, DetectorResult{
		Key: "injection", Label: "Prompt Injection Detection", Enabled: cfg.Injection.Enabled,
		Action: cfg.Injection.Action, Engine: "native", Matches: injMatches,
	})
	if len(injMatches) > 0 {
		result.Decision = strongest(result.Decision, cfg.Injection.Action)
	}

	// Topic boundaries.
	topMatches := []Match{}
	if cfg.Topics.Enabled {
		foundAllowed := false
		for _, topic := range cfg.Topics.Topics {
			if topic == "" {
				continue
			}
			if containsFold(text, topic) {
				if cfg.Topics.Mode == "allow" {
					foundAllowed = true
					continue
				}
				start := strings.Index(strings.ToLower(text), strings.ToLower(topic))
				topMatches = append(topMatches, Match{Entity: "denied_topic", Value: topic, Start: start, End: start + len(topic)})
			}
		}
		if cfg.Topics.Mode == "allow" && !foundAllowed && strings.TrimSpace(text) != "" {
			topMatches = append(topMatches, Match{Entity: "off_topic", Value: strings.Join(cfg.Topics.Topics, ", "), Start: 0, End: 0})
		}
	}
	result.Detectors = append(result.Detectors, DetectorResult{
		Key: "topics", Label: "Topic Boundaries", Enabled: cfg.Topics.Enabled,
		Action: cfg.Topics.Action, Engine: topEngine, Note: topNote, Matches: topMatches,
	})
	if len(topMatches) > 0 {
		result.Decision = strongest(result.Decision, cfg.Topics.Action)
	}

	// Toxicity scoring.
	toxMatches := []Match{}
	if cfg.Toxicity.Enabled {
		for _, category := range cfg.Toxicity.Categories {
			words := toxicityCatalog[category]
			if words == nil {
				continue
			}
			hits := 0
			for _, word := range words {
				if containsFold(text, word) {
					hits++
					toxMatches = append(toxMatches, Match{Entity: category, Value: word, Start: 0, End: 0})
				}
			}
			if hits > 0 {
				score := min(100, hits*25)
				if score >= cfg.Toxicity.Threshold {
					result.Decision = strongest(result.Decision, cfg.Toxicity.Action)
					break
				}
			}
		}
	}
	result.Detectors = append(result.Detectors, DetectorResult{
		Key: "toxicity", Label: "Toxicity Detection", Enabled: cfg.Toxicity.Enabled,
		Action: cfg.Toxicity.Action, Engine: toxEngine, Note: toxNote, Matches: toxMatches,
	})

	// Bias scoring.
	biasMatches := []Match{}
	if cfg.Bias.Enabled {
		for _, category := range cfg.Bias.Categories {
			words := biasCatalog[category]
			if words == nil {
				continue
			}
			hits := 0
			for _, word := range words {
				if containsFold(text, word) {
					hits++
					biasMatches = append(biasMatches, Match{Entity: category, Value: word, Start: 0, End: 0})
				}
			}
			if hits > 0 {
				score := min(100, hits*25)
				if score >= cfg.Bias.Threshold {
					result.Decision = strongest(result.Decision, cfg.Bias.Action)
					break
				}
			}
		}
	}
	result.Detectors = append(result.Detectors, DetectorResult{
		Key: "bias", Label: "Bias Detection", Enabled: cfg.Bias.Enabled,
		Action: cfg.Bias.Action, Engine: "native", Matches: biasMatches,
	})

	return result
}

// resolveEngine maps an engine selection to the effective engine, falling
// back to native when external engines are disabled tenant-wide.
func resolveEngine(engine string, externalDetectors bool, externalName string) (string, string) {
	engine = strings.ToLower(strings.TrimSpace(engine))
	if engine == "" || engine == "native" || engine == "keyword" {
		return "native", ""
	}
	if !externalDetectors {
		return "native", fmt.Sprintf("%s engine requires external detectors; fell back to native", externalName)
	}
	return engine, ""
}

func piiActionLabel(strategy string) string {
	switch strings.ToLower(strings.TrimSpace(strategy)) {
	case "mask":
		return "mask"
	case "hash":
		return "hash"
	default:
		return "redact"
	}
}

// dedupePIIMatches drops CREDIT_CARD hits whose span is exactly matched by a
// more specific entity (a 16-digit NIK also matches the credit-card shape).
func dedupePIIMatches(matches []Match) []Match {
	specific := map[[2]int]bool{}
	for _, m := range matches {
		if m.Entity != "CREDIT_CARD" {
			specific[[2]int{m.Start, m.End}] = true
		}
	}

	out := matches[:0:0]
	for _, m := range matches {
		if m.Entity == "CREDIT_CARD" && specific[[2]int{m.Start, m.End}] {
			continue
		}
		out = append(out, m)
	}
	return out
}

// maskText applies the configured masking strategy over every PII match.
func maskText(text string, matches []Match, strategy string) string {
	if len(matches) == 0 {
		return text
	}

	// Sort by start and drop overlaps so replacements stay consistent.
	sorted := make([]Match, len(matches))
	copy(sorted, matches)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Start < sorted[j].Start
	})

	var b strings.Builder
	cursor := 0
	for _, m := range sorted {
		if m.Start < cursor || m.Start > len(text) || m.End > len(text) {
			continue
		}
		b.WriteString(text[cursor:m.Start])
		switch strings.ToLower(strategy) {
		case "mask":
			b.WriteString(strings.Repeat("*", m.End-m.Start))
		case "hash":
			b.WriteString(fmt.Sprintf("[hash:%x]", fnv32(m.Value)))
		default:
			b.WriteString("<PII>")
		}
		cursor = m.End
	}
	b.WriteString(text[cursor:])
	return b.String()
}

func fnv32(s string) uint32 {
	var h uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}

// strongest resolves the most restrictive action between the current
// decision and a triggered detector action.
func strongest(current, triggered string) string {
	rank := map[string]int{"allow": 0, "log": 1, "hash": 2, "mask": 2, "redact": 2, "warn": 3, "block": 4}
	if rank[triggered] > rank[current] {
		return triggered
	}
	return current
}
