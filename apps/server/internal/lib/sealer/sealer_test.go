package sealer

import (
	"bytes"
	"errors"
	"testing"
)

func TestSealOpenRoundTrip(t *testing.T) {
	s, err := FromSecret("test-app-secret")
	if err != nil {
		t.Fatalf("FromSecret: %v", err)
	}

	secret := "sk-upstream-credentials-🔐"
	sealed, err := s.SealString(secret, PurposeAPIKey)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}

	if sealed.Empty() {
		t.Fatal("sealed output is empty")
	}
	if bytes.Contains([]byte(sealed.Ciphertext), []byte("upstream")) {
		t.Fatal("ciphertext leaks plaintext")
	}

	got, err := s.OpenString(sealed, PurposeAPIKey)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if got != secret {
		t.Fatalf("round trip mismatch: got %q want %q", got, secret)
	}
}

func TestSealUniqueCiphertexts(t *testing.T) {
	s, _ := FromSecret("test-app-secret")

	a, _ := s.SealString("same-secret", PurposeAPIKey)
	b, _ := s.SealString("same-secret", PurposeAPIKey)
	if a.Ciphertext == b.Ciphertext || a.WrappedDEK == b.WrappedDEK {
		t.Fatal("expected unique DEK and nonce per seal")
	}
}

func TestOpenRejectsTamperedCiphertext(t *testing.T) {
	s, _ := FromSecret("test-app-secret")

	sealed, _ := s.SealString("secret", PurposeAPIKey)
	tampered := []byte(sealed.Ciphertext)
	tampered[10] ^= 0xFF

	if _, err := s.Open(Sealed{WrappedDEK: sealed.WrappedDEK, Ciphertext: string(tampered)}, PurposeAPIKey); !errors.Is(err, ErrMalformedCiphertext) {
		t.Fatalf("expected ErrMalformedCiphertext, got %v", err)
	}
}

func TestFromSecretRejectsEmpty(t *testing.T) {
	if _, err := FromSecret(""); err == nil {
		t.Fatal("expected error for empty secret")
	}
}

func TestWrongSecretCannotOpen(t *testing.T) {
	a, _ := FromSecret("secret-one")
	b, _ := FromSecret("secret-two")

	sealed, _ := a.SealString("secret", PurposeAPIKey)
	if _, err := b.Open(sealed, PurposeAPIKey); err == nil {
		t.Fatal("expected error opening with wrong KEK")
	}
}

// A provider credential copied into an API key row must not open there: the
// key reveal endpoint would hand it out.
func TestOpenRejectsAnotherPurpose(t *testing.T) {
	s, _ := FromSecret("test-app-secret")

	sealed, _ := s.SealString("sk-upstream", PurposeAccountSecret)
	if _, err := s.Open(sealed, PurposeAPIKey); !errors.Is(err, ErrMalformedCiphertext) {
		t.Fatalf("opened under another purpose: %v", err)
	}
	if _, _, err := s.Reseal(sealed, PurposeAPIKey); err == nil {
		t.Fatal("Reseal rebound a secret sealed for another purpose")
	}
}

// Secrets sealed before purposes existed carry no additional data: Open
// refuses them until Reseal binds them, once.
func TestResealBindsLegacySecret(t *testing.T) {
	s, _ := FromSecret("test-app-secret")

	legacy, _ := s.SealString("sk-old", "")
	if _, err := s.Open(legacy, PurposeAccountSecret); err == nil {
		t.Fatal("unbound secret opened without Reseal")
	}
	bound, changed, err := s.Reseal(legacy, PurposeAccountSecret)
	if err != nil || !changed {
		t.Fatalf("Reseal = changed %v, err %v", changed, err)
	}
	if got, _ := s.OpenString(bound, PurposeAccountSecret); got != "sk-old" {
		t.Fatalf("resealed secret = %q", got)
	}
	if _, changed, _ := s.Reseal(bound, PurposeAccountSecret); changed {
		t.Fatal("Reseal rewrote an already bound secret")
	}
}
