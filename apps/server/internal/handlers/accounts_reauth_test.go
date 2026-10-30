package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tera-router/server/internal/models"

	"github.com/google/uuid"
)

// TestAccountBaseURLChangeRequiresReauth pins that redirecting a stored
// credential to a new base_url needs the password, while other edits and an
// unchanged base_url do not.
func TestAccountBaseURLChangeRequiresReauth(t *testing.T) {
	h := newBackupHarness(t, "test-secret")
	// Update parses :id as a UUID, unlike seedAccount's fixed ID.
	acc := models.Account{ID: uuid.NewString(), Provider: "openai", Label: "openai", AuthKind: models.AuthAPIKey, Metadata: "{}", Priority: 100}
	if err := sealCredential(h.app, &acc, accountInput{APIKey: "sk-redirect-key-123456"}); err != nil {
		t.Fatal(err)
	}
	if err := h.app.Repos.Accounts.Insert(context.Background(), acc); err != nil {
		t.Fatal(err)
	}
	h.fiber.Patch("/accounts/:id", (&accountsHandler{app: h.app}).Update)

	patch := func(body string) int {
		t.Helper()
		req := httptest.NewRequest(http.MethodPatch, "/accounts/"+acc.ID, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		status, _ := h.do(t, req)
		return status
	}
	baseURL := func() string {
		t.Helper()
		got, err := h.app.Repos.Accounts.Get(context.Background(), acc.ID)
		if err != nil {
			t.Fatal(err)
		}
		return metadataBaseURL(got.Metadata)
	}

	if status := patch(`{"provider":"openai","label":"renamed"}`); status != http.StatusOK {
		t.Fatalf("label edit = %d, want 200 without password", status)
	}
	evil := `{"provider":"openai","metadata":{"base_url":"https://evil.example/v1"}`
	if status := patch(evil + `}`); status == http.StatusOK || baseURL() != "" {
		t.Fatalf("base_url change without password = %d, stored %q", status, baseURL())
	}
	if status := patch(evil + `,"password":"wrong"}`); status != http.StatusUnprocessableEntity || baseURL() != "" {
		t.Fatalf("base_url change with wrong password = %d, stored %q", status, baseURL())
	}
	if status := patch(evil + `,"password":"` + backupAdminPassword + `"}`); status != http.StatusOK || baseURL() != "https://evil.example/v1" {
		t.Fatalf("base_url change with password = %d, stored %q", status, baseURL())
	}
	if status := patch(evil + `}`); status != http.StatusOK {
		t.Fatalf("resending the same base_url = %d, want 200 without password", status)
	}
}
