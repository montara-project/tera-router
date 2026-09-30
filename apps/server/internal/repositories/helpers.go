package repositories

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

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

// translateUnique maps a SQLite UNIQUE-constraint violation onto a typed 409
// carrying a human message (e.g. "chain name already exists"); any other
// error passes through unchanged. The driver surfaces the violation as a
// plain-text error, so the constraint family is matched by message.
func translateUnique(err error, message string) error {
	if err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed") {
		return apperr.New(apperr.KindConflict, "%s", message)
	}
	return err
}

// jsonStrings stores a string slice as a JSON array in a TEXT column. SQLite
// has no array type; a nil slice is written as "[]" so NOT NULL JSON columns
// stay valid, and scanning always yields a non-nil slice.
type jsonStrings []string

func (s jsonStrings) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal([]string(s))
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

func (s *jsonStrings) Scan(src any) error {
	var raw []byte
	switch v := src.(type) {
	case string:
		raw = []byte(v)
	case []byte:
		raw = v
	case nil:
		*s = []string{}
		return nil
	default:
		return fmt.Errorf("jsonStrings: unsupported source type %T", src)
	}
	out := []string{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return fmt.Errorf("jsonStrings: %w", err)
	}
	*s = out
	return nil
}
