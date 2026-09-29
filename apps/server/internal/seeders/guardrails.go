package seeders

import (
	"database/sql"
	"log"
)

// guardrailsSettings is the guardrails settings document: external detector
// engines (Presidio / OpenAI moderation) are on unless the operator turns
// them off for GDPR / data-residency setups.
const guardrailsSettings = `{"external_detectors": true}`

// globalGuardrailsPolicy is the master policy seeded on first run: every
// detector enabled with the reference defaults.
const globalGuardrailsPolicy = `{
  "pii": {
    "enabled": true,
    "entities": ["EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD", "IBAN_CODE",
                 "IP_ADDRESS", "URL", "ID_NIK", "ID_NPWP", "ID_PASSPORT", "PERSON"],
    "masking_strategy": "redact",
    "min_confidence": 0.5,
    "engine": "native",
    "scan_output": false
  },
  "injection": { "enabled": true, "severity": "high", "action": "block" },
  "topics": {
    "enabled": true,
    "mode": "block",
    "topics": ["programming", "devops", "cyber security"],
    "action": "warn",
    "engine": "keyword"
  },
  "toxicity": {
    "enabled": true,
    "categories": ["profanity", "hate speech", "harassment", "violence", "sexual"],
    "threshold": 60,
    "action": "warn",
    "engine": "native"
  },
  "bias": {
    "enabled": true,
    "categories": ["political", "gender", "ethnic", "religious"],
    "threshold": 60,
    "action": "log"
  }
}`

// GuardrailsSeeder seeds the guardrails settings document and the master
// global policy. Both inserts are no-ops on an already-seeded database.
type GuardrailsSeeder struct {
	DB *sql.DB
}

func (s GuardrailsSeeder) Name() string { return "guardrails" }

func (s GuardrailsSeeder) Seed() {
	if _, err := s.DB.Exec(`
		INSERT INTO settings (key, value) VALUES ('guardrails', $1)
		ON CONFLICT (key) DO NOTHING`, guardrailsSettings); err != nil {
		log.Fatalf("seed guardrails settings: %v", err)
	}

	var count int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM guardrail_policies`).Scan(&count); err != nil {
		log.Fatalf("seed guardrails policies: %v", err)
	}
	if count > 0 {
		return
	}

	if _, err := s.DB.Exec(`
		INSERT INTO guardrail_policies (id, name, scope, target, protections, config, enabled)
		VALUES ('gr-global', 'Global Guardrails', 'global', '', $1, $2, 1)`,
		`["PII", "Injection", "Topics", "Toxicity", "Bias"]`, globalGuardrailsPolicy); err != nil {
		log.Fatalf("seed global guardrails policy: %v", err)
	}
	log.Printf("seeded global guardrails policy")
}
