package seeders

import (
	"database/sql"
	"log"

	"tera-router/server/internal/lib/apikey"

	"github.com/google/uuid"
)

// SampleKeySeeder mints one development key so a fresh database has a usable
// credential (mirrors the web mock's "Dev" key). Only runs with --seed dev.
type SampleKeySeeder struct {
	DB *sql.DB
}

func (s SampleKeySeeder) Name() string { return "sample_key" }

func (s SampleKeySeeder) Seed() {
	var exists bool
	if err := s.DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM api_keys WHERE name = 'Dev')`).Scan(&exists); err != nil {
		log.Fatalf("check sample key: %v", err)
	}
	if exists {
		return
	}

	gen, err := apikey.Generate()
	if err != nil {
		log.Fatalf("generate sample key: %v", err)
	}

	_, err = s.DB.Exec(`
		INSERT INTO api_keys (id, plan_id, name, key_hash, lookup_hash, display, scopes)
		VALUES ($1, $2, 'Dev', $3, $4, $5, '')`,
		uuid.NewString(),
		uuid.MustParse("00000000-0000-0000-0000-000000000010").String(),
		gen.Hash, gen.Lookup, gen.Display,
	)
	if err != nil {
		log.Fatalf("seed sample key: %v", err)
	}

	log.Printf("sample key plaintext (copy now): %s", gen.Plaintext)
}
