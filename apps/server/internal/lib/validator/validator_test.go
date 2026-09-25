package validator

import (
	"regexp"
	"testing"
)

func TestRules(t *testing.T) {
	uuid := "f47ac10b-58cc-4372-a567-0e02b2c3d479"

	cases := []struct {
		name  string
		build func(fv *FieldValidator)
		data  interface{}
		pass  bool
	}{
		{"required absent fails", func(fv *FieldValidator) { fv.Required() }, nil, false},
		{"required empty string fails", func(fv *FieldValidator) { fv.Required() }, "", false},
		{"required value passes", func(fv *FieldValidator) { fv.Required() }, "x", true},
		{"required zero passes", func(fv *FieldValidator) { fv.Required() }, float64(0), true},
		{"string absent passes", func(fv *FieldValidator) { fv.String() }, nil, true},
		{"string rejects number", func(fv *FieldValidator) { fv.String() }, float64(1), false},
		{"email ok", func(fv *FieldValidator) { fv.Email() }, "a@b.co", true},
		{"email bad", func(fv *FieldValidator) { fv.Email() }, "nope", false},
		{"email absent passes", func(fv *FieldValidator) { fv.Email() }, nil, true},
		{"uuid ok", func(fv *FieldValidator) { fv.UUID() }, uuid, true},
		{"uuid bad", func(fv *FieldValidator) { fv.UUID() }, "nope", false},
		{"uuid non-string fails", func(fv *FieldValidator) { fv.UUID() }, float64(1), false},
		{"withins ok", func(fv *FieldValidator) { fv.WithinS("a", "b") }, "a", true},
		{"withins bad", func(fv *FieldValidator) { fv.WithinS("a", "b") }, "z", false},
		{"withins non-string passes", func(fv *FieldValidator) { fv.WithinS("a", "b") }, float64(1), true},
		{"regex ok", func(fv *FieldValidator) { fv.Regex(`^\d+$`) }, "42", true},
		{"regex bad", func(fv *FieldValidator) { fv.Regex(`^\d+$`) }, "x", false},
		{"match ok", func(fv *FieldValidator) { fv.Match(regexp.MustCompile(`^a`)) }, "abc", true},
	}

	for _, tc := range cases {
		v := NewMapValidator()
		tc.build(v.Field("f"))
		mr, pass := v.Validate(map[string]interface{}{"f": tc.data})
		if pass != tc.pass {
			t.Errorf("%s: pass=%v, want %v (mr=%v)", tc.name, pass, tc.pass, mr)
		}
		if pass && !mr.Empty() {
			t.Errorf("%s: passing validation returned messages %v", tc.name, mr)
		}
		if !pass && len(mr["f"]) == 0 {
			t.Errorf("%s: failing validation returned no message for f", tc.name)
		}
	}
}

func TestValidate_CollectsPerFieldMessages(t *testing.T) {
	v := NewMapValidator()
	v.Field("name").Required()
	v.Field("role").Required().WithinS("admin", "member")

	mr, pass := v.Validate(map[string]interface{}{"role": "bogus"})
	if pass {
		t.Fatal("expected validation to fail")
	}
	if len(mr["name"]) != 1 || mr["name"][0] != "name is required" {
		t.Fatalf("expected name required message, got %v", mr["name"])
	}
	if len(mr["role"]) != 1 {
		t.Fatalf("expected one role message, got %v", mr["role"])
	}
}

func TestFieldValidator_StopsAtFirstFailure(t *testing.T) {
	v := NewMapValidator()
	v.Field("role").Required().WithinS("admin")

	mr, pass := v.Validate(map[string]interface{}{})
	if pass || len(mr["role"]) != 1 || mr["role"][0] != "role is required" {
		t.Fatalf("expected only the required message, got %v", mr)
	}
}
