package validator

import (
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"
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
	re := regexp.MustCompile(pattern)
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

// Range bounds a JSON number to [min, max]; a missing field passes, and
// non-finite values (NaN, infinities — unreachable from encoding/json but not
// from a constructed dict) fail rather than slipping through the comparison.
func (v *FieldValidator) Range(min, max float64) *FieldValidator {
	v.registerRule(func(key string, data interface{}) (string, bool) {
		if data == nil {
			return "", true
		}
		n, ok := data.(float64)
		if !ok || math.IsNaN(n) || math.IsInf(n, 0) || n < min || n > max {
			return fmt.Sprintf("%s must be between %g and %g", key, min, max), false
		}
		return "", true
	})
	return v
}
