package seeders

import (
	"database/sql"
	"errors"
	"log"

	"tera-router/server/internal/lib/apikey"
	"tera-router/server/internal/lib/sealer"

	"github.com/google/uuid"
)

// SampleKeySeeder mints one development key so a fresh database has a usable
// credential (mirrors the web mock's "Dev" key). Only runs with --seed dev.
type SampleKeySeeder struct {
	DB *sql.DB
	// Secrets seals the generated plaintext so the dashboard reveal endpoint
	// can recover it; required because the row is inserted directly, bypassing
	// the keys handler which seals on create.
	Secrets *sealer.Sealer
}

func (s SampleKeySeeder) Name() string { return "sample_key" }

func (s SampleKeySeeder) Seed() {
	var id string
	var recoverable bool
	err := s.DB.QueryRow(`
		SELECT id, secret_wrapped_dek != '' AND secret_ciphertext != ''
		FROM api_keys WHERE name = 'Dev'`).Scan(&id, &recoverable)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Fatalf("check sample key: %v", err)
	}
	if err == nil && recoverable {
		return
	}

	gen, err := apikey.Generate()
	if err != nil {
		log.Fatalf("generate sample key: %v", err)
	}
	sealed, err := s.Secrets.SealString(gen.Plaintext)
	if err != nil {
		log.Fatalf("seal sample key: %v", err)
	}

	if err == nil {
		// The row predates sealed secrets: rotate the credential in place so
		// reveal/copy work again, keeping id, plan binding, and scopes.
		if _, err := s.DB.Exec(`
			UPDATE api_keys
			SET key_hash = $1, lookup_hash = $2, display = $3,
			    secret_wrapped_dek = $4, secret_ciphertext = $5
			WHERE id = $6`,
			gen.Hash, gen.Lookup, gen.Display, sealed.WrappedDEK, sealed.Ciphertext, id,
		); err != nil {
			log.Fatalf("rotate sample key: %v", err)
		}
		log.Printf("sample key rotated; plaintext (copy now): %s", gen.Plaintext)
		return
	}

	_, err = s.DB.Exec(`
		INSERT INTO api_keys (id, plan_id, name, key_hash, lookup_hash, display, scopes, secret_wrapped_dek, secret_ciphertext)
		VALUES ($1, $2, 'Dev', $3, $4, $5, '', $6, $7)`,
		uuid.NewString(),
		uuid.MustParse("00000000-0000-0000-0000-000000000010").String(),
		gen.Hash, gen.Lookup, gen.Display, sealed.WrappedDEK, sealed.Ciphertext,
	)
	if err != nil {
		log.Fatalf("seed sample key: %v", err)
	}

	log.Printf("sample key plaintext (copy now): %s", gen.Plaintext)
}
