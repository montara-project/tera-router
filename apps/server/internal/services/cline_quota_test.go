package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// The balance is read in two steps (who am I, then that user's balance) with
// the key sent as the gateway sends it, and converted from millionths.
func TestClineBalance(t *testing.T) {
	var auths []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auths = append(auths, r.Header.Get("Authorization"))
		switch r.URL.Path {
		case "/api/v1/users/me":
			_, _ = w.Write([]byte(`{"data":{"id":"usr-1","email":"a@b.c"},"success":true}`))
		case "/api/v1/users/usr-1/balance":
			_, _ = w.Write([]byte(`{"data":{"userId":"usr-1","balance":-24330},"success":true}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	svc := &UpstreamService{}
	got, err := svc.ClineBalance(context.Background(), srv.URL+"/api/v1/", "sk_native")
	if err != nil {
		t.Fatalf("ClineBalance: %v", err)
	}
	if got.Units != -24330 || got.Credits != -0.02433 {
		t.Errorf("balance = %+v, want -24330 units = -0.02433 credits", got)
	}
	if len(auths) != 2 || auths[0] != "Bearer sk_native" || auths[1] != "Bearer sk_native" {
		t.Errorf("auth headers = %v, want the native key unprefixed on both calls", auths)
	}

	auths = nil
	if _, err := svc.ClineBalance(context.Background(), srv.URL+"/api/v1", "session-token"); err != nil {
		t.Fatalf("ClineBalance with a session token: %v", err)
	}
	if auths[0] != "Bearer workos:session-token" {
		t.Errorf("auth = %q, want the workos-prefixed token", auths[0])
	}
}

func TestClineBalanceRejectedKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
	}))
	defer srv.Close()

	if _, err := (&UpstreamService{}).ClineBalance(context.Background(), srv.URL, "sk_bad"); err == nil {
		t.Fatal("a rejected key must be an error")
	}
}
