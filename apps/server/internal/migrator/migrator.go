// Package migrator applies the SQL migrations in ./migrations to a live
// database via golang-migrate. It is shared by the migrate CLI (cmd/migrate)
// and the migrate-on-boot path in cmd/api.
//
// The migrations directory is resolved relative to the process working
// directory, so both commands must be launched from apps/server.
package migrator

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"

	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// DefaultDir is the migrations directory relative to apps/server.
const DefaultDir = "./migrations"

func newMigrate(db *sql.DB, dir string) (*migrate.Migrate, error) {
	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return nil, fmt.Errorf("build postgres driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance("file://"+dir, "postgres", driver)
	if err != nil {
		return nil, fmt.Errorf("init migrate: %w", err)
	}
	return m, nil
}

// Up applies every pending migration. An already-migrated database is a
// no-op success.
func Up(db *sql.DB, dir string) error {
	m, err := newMigrate(db, dir)
	if err != nil {
		return err
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("up migrations: %w", err)
	}
	return nil
}

// Down rolls back every migration.
func Down(db *sql.DB, dir string) error {
	m, err := newMigrate(db, dir)
	if err != nil {
		return err
	}

	if err := m.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("down migrations: %w", err)
	}
	return nil
}
