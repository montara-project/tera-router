package dtos

import (
	"testing"

	"tera-router/server/internal/lib/validator"
)

func TestChainValidate(t *testing.T) {
	check := func(body map[string]interface{}) bool {
		v := validator.NewMapValidator()
		(&Chain{}).Validate(v)
		_, ok := v.Validate(body)
		return ok
	}

	for _, name := range []string{"production-fallback", "deepseek_v4.1", "A1"} {
		if !check(map[string]interface{}{"name": name}) {
			t.Errorf("name %q rejected", name)
		}
	}
	for _, name := range []string{"", "has space", "chain:x", "a/b"} {
		if check(map[string]interface{}{"name": name}) {
			t.Errorf("name %q accepted", name)
		}
	}

}
