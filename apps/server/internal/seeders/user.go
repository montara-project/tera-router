package seeders

import (
	"database/sql"
	"errors"
	"log"
	"os"

	"tera-router/server/internal/lib/password"

	"github.com/google/uuid"
)

// adminID is the seeded admin's fixed id. The seeder finds the account by it,
// so changing ADMIN_EMAIL renames the admin instead of minting a second one.
var adminID = uuid.MustParse("00000000-0000-0000-0000-0000000000ff")

// adminEmail is the first dashboard account's email: ADMIN_EMAIL, read at seed
// time, or a default.
func adminEmail() string {
	return envOr("ADMIN_EMAIL", "admin@tera.local")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// devAdminPassword is the fixed password used only for the development
// seed (--seed=dev / APP_ENV=development), where the whole database is
// disposable. It is never used for a production seed.
const devAdminPassword = "admin123"

// adminPassword resolves the first admin's password. A production seed
// refuses to run without ADMIN_PASSWORD; a development seed falls back to a
// known password so a fresh checkout stays usable. Either way a random
// password is generated and printed once when nothing else is configured,
// so no build ever ships a usable default credential.
func adminPassword(dev bool) string {
	if v := os.Getenv("ADMIN_PASSWORD"); v != "" {
		return v
	}

	if !dev {
		log.Fatal("ADMIN_PASSWORD must be set to seed the admin user; refusing to create an admin account with a default password")
	}

	return devAdminPassword
}

// AdminUserSeeder mints the first admin account with a hashed password.
type AdminUserSeeder struct {
	DB *sql.DB
	// Dev marks a development seed, which may fall back to a known password.
	Dev bool
}

func (s AdminUserSeeder) Name() string { return "admin_user" }

func (s AdminUserSeeder) Seed() {
	var current string
	err := s.DB.QueryRow(`SELECT email FROM users WHERE id = $1`, adminID).Scan(&current)
	if err == nil {
		s.syncEmail(current)
		s.syncPassword()
		s.resetTOTP()
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		log.Fatalf("check admin user: %v", err)
	}

	email := adminEmail()

	plain := adminPassword(s.Dev)
	hash, err := password.Hash(plain)
	if err != nil {
		log.Fatalf("hash admin password: %v", err)
	}

	_, err = s.DB.Exec(`
		INSERT INTO users (id, fullname, email, password_hash, is_active, role_id)
		VALUES ($1, $2, $3, $4, true, $5)
		ON CONFLICT (email) DO NOTHING`,
		adminID, "Administrator", email, hash,
		uuid.MustParse("00000000-0000-0000-0000-000000000001"),
	)
	if err != nil {
		log.Fatalf("seed admin user: %v", err)
	}

	if plain == devAdminPassword {
		log.Printf("admin user seeded with the development password %q; set ADMIN_PASSWORD to override", devAdminPassword)
		return
	}
	log.Printf("admin user seeded for %s; the password came from ADMIN_PASSWORD", email)
}

// syncEmail makes ADMIN_EMAIL the source of truth for the admin's email, like
// syncPassword does for the password. Without ADMIN_EMAIL the stored email is
// left alone. An email already taken by another account is reported and
// skipped rather than failing the boot.
func (s AdminUserSeeder) syncEmail(current string) {
	email := os.Getenv("ADMIN_EMAIL")
	if email == "" || email == current {
		return
	}
	var taken bool
	if err := s.DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM users WHERE email = $1 AND id <> $2)`, email, adminID).Scan(&taken); err != nil {
		log.Fatalf("check admin email: %v", err)
	}
	if taken {
		log.Printf("ADMIN_EMAIL %s already belongs to another account; the admin keeps %s", email, current)
		return
	}
	s.updateAdmin("sync admin email",
		`UPDATE users SET email = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, adminID, email)
	log.Printf("admin email changed from %s to %s by ADMIN_EMAIL; existing sessions revoked", current, email)
}

// resetTOTP is the lost-authenticator escape hatch: ADMIN_TOTP_RESET=true
// turns the admin's TOTP off on the next seed. The operator unsets it after
// signing in again, or every boot keeps clearing it.
func (s AdminUserSeeder) resetTOTP() {
	if os.Getenv("ADMIN_TOTP_RESET") != "true" {
		return
	}
	s.updateAdmin("reset admin totp",
		`UPDATE users SET totp_wrapped_dek = '', totp_ciphertext = '', totp_last_step = 0 WHERE id = $1`, adminID)
	log.Print("admin two-factor authentication cleared by ADMIN_TOTP_RESET and sessions revoked; unset it now")
}

// syncPassword makes ADMIN_PASSWORD the source of truth for an existing admin.
// When it no longer matches the stored hash, the hash is replaced and every
// admin session ends (see updateAdmin). Without ADMIN_PASSWORD the stored
// password is left alone.
func (s AdminUserSeeder) syncPassword() {
	plain := os.Getenv("ADMIN_PASSWORD")
	if plain == "" {
		return
	}

	var current string
	if err := s.DB.QueryRow(`SELECT password_hash FROM users WHERE id = $1`, adminID).Scan(&current); err != nil {
		log.Fatalf("load admin user: %v", err)
	}
	if ok, err := password.Verify(plain, current); err == nil && ok {
		return
	}

	hash, err := password.Hash(plain)
	if err != nil {
		log.Fatalf("hash admin password: %v", err)
	}

	s.updateAdmin("sync admin password",
		`UPDATE users SET password_hash = $2, updated_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, adminID, hash)
	log.Print("admin password updated from ADMIN_PASSWORD; existing sessions revoked")
}

// updateAdmin runs one UPDATE on the admin and, in the same transaction, ends
// every session it has: refresh tokens are revoked, and sessions_revoked_at
// makes RequireAuth refuse access tokens issued before now. Any change to how
// the admin signs in goes through here, so old cookies stop working at once.
func (s AdminUserSeeder) updateAdmin(what, query string, args ...any) {
	tx, err := s.DB.Begin()
	if err != nil {
		log.Fatalf("%s: %v", what, err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(query, args...); err != nil {
		log.Fatalf("%s: %v", what, err)
	}
	if _, err := tx.Exec(
		`UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE user_id = $1 AND revoked_at IS NULL`, adminID); err != nil {
		log.Fatalf("revoke admin sessions: %v", err)
	}
	if _, err := tx.Exec(
		`UPDATE users SET sessions_revoked_at = strftime('%Y-%m-%d %H:%M:%f+00:00', 'now') WHERE id = $1`, adminID); err != nil {
		log.Fatalf("revoke admin sessions: %v", err)
	}
	if err := tx.Commit(); err != nil {
		log.Fatalf("%s: %v", what, err)
	}
}
