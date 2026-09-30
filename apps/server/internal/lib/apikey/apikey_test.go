package apikey

import (
	"strings"
	"testing"
)

func TestGenerateShape(t *testing.T) {
	got, err := Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	if !strings.HasPrefix(got.Plaintext, Prefix) {
		t.Fatalf("expected %q prefix, got %q", Prefix, got.Plaintext)
	}
	if got.Lookup != LookupHash(got.Plaintext) {
		t.Fatal("lookup does not match sha256 of plaintext")
	}
	if got.Display == got.Plaintext {
		t.Fatal("display must mask the plaintext")
	}
	if strings.Contains(got.Display, got.Plaintext[len(Prefix):len(Prefix)+20]) {
		t.Fatal("display leaks most of the key body")
	}
}

func TestVerifyRoundTrip(t *testing.T) {
	got, err := Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	ok, err := Verify(got.Plaintext, got.Hash)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if !ok {
		t.Fatal("expected plaintext to verify against hash")
	}

	ok, _ = Verify(kr_PrefixOtherKey(), got.Hash)
	if ok {
		t.Fatal("expected different key to fail verification")
	}
}

func kr_PrefixOtherKey() string {
	got, _ := Generate()
	return got.Plaintext
}

func TestMaskShortBody(t *testing.T) {
	if got := Mask(Prefix + "123"); got != Prefix+"…" {
		t.Fatalf("short body mask: got %q", got)
	}
}
