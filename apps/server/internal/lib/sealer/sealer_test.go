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
	sealed, err := s.SealString(secret)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}

	if sealed.Empty() {
		t.Fatal("sealed output is empty")
	}
	if bytes.Contains([]byte(sealed.Ciphertext), []byte("upstream")) {
		t.Fatal("ciphertext leaks plaintext")
	}

	got, err := s.OpenString(sealed)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if got != secret {
		t.Fatalf("round trip mismatch: got %q want %q", got, secret)
	}
}

func TestSealUniqueCiphertexts(t *testing.T) {
	s, _ := FromSecret("test-app-secret")

	a, _ := s.SealString("same-secret")
	b, _ := s.SealString("same-secret")
	if a.Ciphertext == b.Ciphertext || a.WrappedDEK == b.WrappedDEK {
		t.Fatal("expected unique DEK and nonce per seal")
	}
}

func TestOpenRejectsTamperedCiphertext(t *testing.T) {
	s, _ := FromSecret("test-app-secret")

	sealed, _ := s.SealString("secret")
	tampered := []byte(sealed.Ciphertext)
	tampered[10] ^= 0xFF

	if _, err := s.Open(Sealed{WrappedDEK: sealed.WrappedDEK, Ciphertext: string(tampered)}); !errors.Is(err, ErrMalformedCiphertext) {
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

	sealed, _ := a.SealString("secret")
	if _, err := b.Open(sealed); err == nil {
		t.Fatal("expected error opening with wrong KEK")
	}
}
