package repositories

import (
	"database/sql"
	"errors"

	"tera-router/server/internal/lib/apperr"
)

// translateNotFound maps sql.ErrNoRows onto the typed app error so services
// and handlers can handle misses uniformly.
func translateNotFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return apperr.ErrNotFound
	}
	return err
}
