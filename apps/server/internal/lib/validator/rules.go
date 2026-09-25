package validator

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/google/uuid"
)

// rule reports a failure message; ok=false means validation failed. data
// always comes from JSON decoding, so it is never a pointer.
type rule func(key string, data interface{}) (string, bool)

func (v *FieldValidator) Required() *FieldValidator {
	v.registerRule(func(key string, data interface{}) (string, bool) {
		if data == nil || data == "" {
			return fmt.Sprintf("%s is required", key), false
		}
		return "", true
	})
	return v
}

func (v *FieldValidator) String() *FieldValidator {
	v.registerRule(func(key string, data interface{}) (string, bool) {
		if _, ok := data.(string); data != nil && !ok {
			return fmt.Sprintf("%s must be a string", key), false
		}
		return "", true
	})
	return v
}

func (v *FieldValidator) Regex(pattern string) *FieldValidator {
	return v.Match(regexp.MustCompile(pattern))
}

// Match validates a string against a pre-compiled pattern; prefer it over
// Regex when the pattern is a package-level var so it is not recompiled per
// request.
func (v *FieldValidator) Match(re *regexp.Regexp) *FieldValidator {
	v.registerRule(func(key string, data interface{}) (string, bool) {
		if data == nil {
			return "", true
		}
		if s, ok := data.(string); !ok || !re.MatchString(s) {
			return fmt.Sprintf("%s must match the pattern %s", key, re), false
		}
		return "", true
	})
	return v
}

var emailPattern = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func (v *FieldValidator) Email() *FieldValidator {
	v.registerRule(func(key string, data interface{}) (string, bool) {
		if data == nil {
			return "", true
		}
		if s, ok := data.(string); !ok || !emailPattern.MatchString(s) {
			return fmt.Sprintf("%s must be a valid email address", key), false
		}
		return "", true
	})
	return v
}

func (v *FieldValidator) WithinS(vals ...string) *FieldValidator {
	v.registerRule(func(key string, data interface{}) (string, bool) {
		if s, ok := data.(string); ok && !slices.Contains(vals, s) {
			return fmt.Sprintf("%s may only contain %s", key, strings.Join(vals, ", ")), false
		}
		return "", true
	})
	return v
}

func (v *FieldValidator) UUID() *FieldValidator {
	v.registerRule(func(key string, data interface{}) (string, bool) {
		if data == nil {
			return "", true
		}
		if s, ok := data.(string); !ok {
			return fmt.Sprintf("%s must be a valid UUID", key), false
		} else if _, err := uuid.Parse(s); err != nil {
			return fmt.Sprintf("%s must be a valid UUID", key), false
		}
		return "", true
	})
	return v
}
