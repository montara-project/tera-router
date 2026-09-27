package password

import "testing"

func TestHashVerifyRoundTrip(t *testing.T) {
	hash, err := Hash("correct horse battery staple")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}

	ok, err := Verify("correct horse battery staple", hash)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if !ok {
		t.Fatal("expected correct password to verify")
	}
}

func TestVerifyRejectsWrongPassword(t *testing.T) {
	hash, _ := Hash("correct")
	ok, err := Verify("incorrect", hash)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if ok {
		t.Fatal("expected wrong password to fail")
	}
}

func TestHashesAreUnique(t *testing.T) {
	a, _ := Hash("same")
	b, _ := Hash("same")
	if a == b {
		t.Fatal("expected unique salts to produce unique hashes")
	}
}

func TestVerifyInvalidHash(t *testing.T) {
	if _, err := Verify("x", "not-a-hash"); err == nil {
		t.Fatal("expected error for malformed hash")
	}
}
