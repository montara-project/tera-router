package main

import (
	"strings"
	"testing"
)

func TestInjectAppEnv(t *testing.T) {
	html := `<html><head><script>window.__APP_ENV__ = {}</script></head></html>`

	got := injectAppEnv([]byte(html), "https://api.example.com")
	if !strings.Contains(got, `window.__APP_ENV__ = {"API_URL":"https://api.example.com"}`) {
		t.Fatalf("expected injected config, got %s", got)
	}
}

func TestInjectAppEnvEscapesValue(t *testing.T) {
	html := `<script>window.__APP_ENV__ = {}</script>`

	got := injectAppEnv([]byte(html), `https://x"onload="evil()`)
	if strings.Contains(got, `"onload="evil`) {
		t.Fatalf("unescaped quote broke out of the JSON string: %s", got)
	}
	if !strings.Contains(got, `"API_URL":"https://x\"onload=\"evil()"`) {
		t.Fatalf("expected JSON-escaped value, got %s", got)
	}
}

func TestInjectAppEnvNoMarker(t *testing.T) {
	html := `<html><head></head></html>`

	if got := injectAppEnv([]byte(html), "https://api.example.com"); got != html {
		t.Fatalf("expected unchanged HTML without the marker, got %s", got)
	}
}
