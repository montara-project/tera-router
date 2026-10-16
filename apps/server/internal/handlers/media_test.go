package handlers

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/gofiber/fiber/v3"
)

// The Media page lists the catalog's non-chat providers: chat-only providers
// and the custom-provider templates stay out, and embeddings reads as "embed".
func TestMediaIndexFollowsCatalog(t *testing.T) {
	app := fiber.New()
	app.Get("/media", (&mediaHandler{}).Index)
	resp, err := app.Test(httptest.NewRequest("GET", "/media", nil))
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(resp.Body)
	var body struct {
		Data struct {
			Providers []struct {
				Slug         string
				Capabilities []string
			}
		}
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("decode %s: %v", raw, err)
	}
	caps := map[string][]string{}
	for _, p := range body.Data.Providers {
		caps[p.Slug] = p.Capabilities
	}

	for slug, want := range map[string]string{"gemini": "embed", "voyage-ai": "embed", "exa": "search", "deepgram": "tts", "openai": "image"} {
		if !slices.Contains(caps[slug], want) {
			t.Errorf("%s capabilities = %v, want %q", slug, caps[slug], want)
		}
	}
	for _, slug := range []string{"anthropic", "cline", "custom-openai"} {
		if _, ok := caps[slug]; ok {
			t.Errorf("%s listed on the Media page", slug)
		}
	}
}
