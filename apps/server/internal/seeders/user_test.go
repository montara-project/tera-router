package seeders

import (
	"database/sql"
	"path/filepath"
	"testing"

	"tera-router/server/internal/database"
	"tera-router/server/internal/lib/password"
	"tera-router/server/internal/migrator"
)

func TestAdminPasswordSyncsFromEnv(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "seed_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	RoleSeeder{DB: db}.Seed()

	t.Setenv("ADMIN_PASSWORD", "first-pass")
	AdminUserSeeder{DB: db}.Seed()
	assertAdminPassword(t, db, "first-pass")

	if _, err := db.Exec(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
		VALUES ('rt-1', '00000000-0000-0000-0000-0000000000ff', 'h', '2999-01-01')`); err != nil {
		t.Fatalf("insert refresh token: %v", err)
	}

	t.Setenv("ADMIN_PASSWORD", "second-pass")
	AdminUserSeeder{DB: db}.Seed()
	assertAdminPassword(t, db, "second-pass")

	assertSessionsRevoked(t, db, "rt-1")

	// A restart with unchanged env must not sign anyone out.
	if _, err := db.Exec(`UPDATE users SET sessions_revoked_at = NULL WHERE id = $1`, adminID); err != nil {
		t.Fatal(err)
	}
	insertRefresh(t, db, "rt-2")
	AdminUserSeeder{DB: db}.Seed()
	var revoked, sessions sql.NullString
	_ = db.QueryRow(`SELECT revoked_at FROM refresh_tokens WHERE id = 'rt-2'`).Scan(&revoked)
	_ = db.QueryRow(`SELECT sessions_revoked_at FROM users WHERE id = $1`, adminID).Scan(&sessions)
	if revoked.Valid || sessions.Valid {
		t.Fatal("an unchanged ADMIN_PASSWORD revoked sessions on reboot")
	}

	// Unset env keeps the stored password.
	t.Setenv("ADMIN_PASSWORD", "")
	AdminUserSeeder{DB: db, Dev: true}.Seed()
	assertAdminPassword(t, db, "second-pass")
}

func TestAdminTOTPReset(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "seed_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	RoleSeeder{DB: db}.Seed()
	AdminUserSeeder{DB: db, Dev: true}.Seed()
	if _, err := db.Exec(`UPDATE users SET totp_wrapped_dek = 'd', totp_ciphertext = 'c' WHERE id = $1`, adminID); err != nil {
		t.Fatal(err)
	}

	enabled := func() bool {
		var c string
		if err := db.QueryRow(`SELECT totp_ciphertext FROM users WHERE id = $1`, adminID).Scan(&c); err != nil {
			t.Fatal(err)
		}
		return c != ""
	}

	AdminUserSeeder{DB: db, Dev: true}.Seed()
	if !enabled() {
		t.Fatal("TOTP cleared without ADMIN_TOTP_RESET")
	}
	insertRefresh(t, db, "rt-totp")
	t.Setenv("ADMIN_TOTP_RESET", "true")
	AdminUserSeeder{DB: db, Dev: true}.Seed()
	if enabled() {
		t.Fatal("ADMIN_TOTP_RESET=true should clear TOTP")
	}
	assertSessionsRevoked(t, db, "rt-totp")
}

func assertAdminPassword(t *testing.T, db *sql.DB, want string) {
	t.Helper()
	var hash string
	if err := db.QueryRow(`SELECT password_hash FROM users WHERE id = $1`, adminID).Scan(&hash); err != nil {
		t.Fatalf("load admin: %v", err)
	}
	if ok, _ := password.Verify(want, hash); !ok {
		t.Fatalf("admin password does not match %q", want)
	}
}

func TestAdminEmailSyncsFromEnv(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "seed_test.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := migrator.Up(db, "../../migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	RoleSeeder{DB: db}.Seed()

	email := func() string {
		var e string
		if err := db.QueryRow(`SELECT email FROM users WHERE id = $1`, adminID).Scan(&e); err != nil {
			t.Fatal(err)
		}
		return e
	}
	count := func() int {
		var n int
		if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

	t.Setenv("ADMIN_EMAIL", "first@tera.local")
	AdminUserSeeder{DB: db, Dev: true}.Seed()

	insertRefresh(t, db, "rt-email")
	t.Setenv("ADMIN_EMAIL", "second@tera.local")
	AdminUserSeeder{DB: db, Dev: true}.Seed()
	if got := email(); got != "second@tera.local" || count() != 1 {
		t.Fatalf("email = %s with %d users, want the one admin renamed", got, count())
	}
	assertSessionsRevoked(t, db, "rt-email")

	// An email another account owns is skipped, not stolen.
	if _, err := db.Exec(`INSERT INTO users (id, fullname, email, password_hash, role_id)
		VALUES ('other', 'Other', 'taken@tera.local', 'x', '00000000-0000-0000-0000-000000000001')`); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ADMIN_EMAIL", "taken@tera.local")
	AdminUserSeeder{DB: db, Dev: true}.Seed()
	if got := email(); got != "second@tera.local" {
		t.Fatalf("email = %s, want it kept when the new one is taken", got)
	}

	// Unset env keeps the stored email.
	t.Setenv("ADMIN_EMAIL", "")
	AdminUserSeeder{DB: db, Dev: true}.Seed()
	if got := email(); got != "second@tera.local" {
		t.Fatalf("email = %s, want it kept without ADMIN_EMAIL", got)
	}
}

// assertSessionsRevoked checks that every admin session ended: the refresh
// token is revoked and sessions_revoked_at is set for RequireAuth.
func assertSessionsRevoked(t *testing.T, db *sql.DB, refreshID string) {
	t.Helper()
	var revoked, sessions sql.NullString
	if err := db.QueryRow(`SELECT revoked_at FROM refresh_tokens WHERE id = $1`, refreshID).Scan(&revoked); err != nil {
		t.Fatalf("load refresh token: %v", err)
	}
	if err := db.QueryRow(`SELECT sessions_revoked_at FROM users WHERE id = $1`, adminID).Scan(&sessions); err != nil {
		t.Fatalf("load admin: %v", err)
	}
	if !revoked.Valid || !sessions.Valid {
		t.Fatalf("refresh revoked = %v, sessions_revoked_at = %v; want both set", revoked.Valid, sessions.Valid)
	}
}

func insertRefresh(t *testing.T, db *sql.DB, id string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
		VALUES ($1, $2, $1, '2999-01-01')`, id, adminID.String()); err != nil {
		t.Fatalf("insert refresh token: %v", err)
	}
}
