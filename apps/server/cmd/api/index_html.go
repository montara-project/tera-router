package main

import (
	"encoding/json"
	"log/slog"
	"os"
	"path"
	"strings"

	"github.com/gofiber/fiber/v3"
)

// appEnvMarker is the inline placeholder in the web-ui's index.html that the
// runtime config replaces. Vite copies it through to dist unchanged.
const appEnvMarker = "window.__APP_ENV__ = {}"

// injectAppEnv writes the runtime API_URL into the bundled index.html so the
// shipped image can point the UI at another origin without a rebuild.
func injectAppEnv(indexHTML []byte, apiURL string) string {
	cfg, _ := json.Marshal(map[string]string{"API_URL": apiURL})
	return strings.Replace(string(indexHTML), appEnvMarker, "window.__APP_ENV__ = "+string(cfg), 1)
}

// newIndexHandler serves index.html with the runtime config injected. The file
// is read once at boot: hashed assets change only with a new image, and a
// changed API_URL is picked up on the next page load, not a rebuild.
func newIndexHandler(publicDir string, apiURL string, logger *slog.Logger) fiber.Handler {
	indexPath := path.Join(publicDir, "index.html")
	raw, err := os.ReadFile(indexPath)
	if err != nil {
		logger.Warn("index.html unreadable; serving it without runtime config", "path", indexPath, "error", err)
		return func(c fiber.Ctx) error { return c.SendFile(indexPath) }
	}
	rendered := injectAppEnv(raw, apiURL)
	return func(c fiber.Ctx) error {
		c.Set(fiber.HeaderContentType, fiber.MIMETextHTMLCharsetUTF8)
		// The body depends on config; revalidate so a redeploy with a new
		// API_URL is not masked by a stale cached copy.
		c.Set(fiber.HeaderCacheControl, "no-cache")
		return c.SendString(rendered)
	}
}
