package password

import (
	"testing"
	"time"
)

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

// A full set of argon2 slots makes the next hash wait for one to free up.
func TestHashWaitsForFreeSlot(t *testing.T) {
	for i := 0; i < maxConcurrent; i++ {
		slots <- struct{}{}
	}
	done := make(chan struct{})
	go func() {
		_, _ = Hash("queued")
		close(done)
	}()

	select {
	case <-done:
		t.Fatal("hash ran while every slot was taken")
	case <-time.After(100 * time.Millisecond):
	}
	for i := 0; i < maxConcurrent; i++ {
		<-slots
	}
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("hash did not run once slots freed up")
	}
}
