package repositories

import (
	"database/sql"

	"tera-router/server/internal/config"
)

type Repositories struct{}

func New(db *sql.DB, cfg *config.ConfigApp) Repositories {
	return Repositories{}
}
