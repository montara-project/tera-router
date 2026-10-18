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

	var revoked sql.NullString
	if err := db.QueryRow(`SELECT revoked_at FROM refresh_tokens WHERE id = 'rt-1'`).Scan(&revoked); err != nil {
		t.Fatalf("load refresh token: %v", err)
	}
	if !revoked.Valid {
		t.Fatal("expected the old session to be revoked after a password change")
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
	if _, err := db.Exec(`UPDATE users SET totp_wrapped_dek = 'd', totp_ciphertext = 'c' WHERE email = $1`, adminEmail); err != nil {
		t.Fatal(err)
	}

	enabled := func() bool {
		var c string
		if err := db.QueryRow(`SELECT totp_ciphertext FROM users WHERE email = $1`, adminEmail).Scan(&c); err != nil {
			t.Fatal(err)
		}
		return c != ""
	}

	AdminUserSeeder{DB: db, Dev: true}.Seed()
	if !enabled() {
		t.Fatal("TOTP cleared without ADMIN_TOTP_RESET")
	}
	t.Setenv("ADMIN_TOTP_RESET", "true")
	AdminUserSeeder{DB: db, Dev: true}.Seed()
	if enabled() {
		t.Fatal("ADMIN_TOTP_RESET=true should clear TOTP")
	}
}

func assertAdminPassword(t *testing.T, db *sql.DB, want string) {
	t.Helper()
	var hash string
	if err := db.QueryRow(`SELECT password_hash FROM users WHERE email = $1`, adminEmail).Scan(&hash); err != nil {
		t.Fatalf("load admin: %v", err)
	}
	if ok, _ := password.Verify(want, hash); !ok {
		t.Fatalf("admin password does not match %q", want)
	}
}
