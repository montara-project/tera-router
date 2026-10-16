package gateway

import (
	"cmp"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"tera-router/server/internal/catalog"
	"tera-router/server/internal/connectors"
	"tera-router/server/internal/core"

	"github.com/gofiber/fiber/v3"
)

// handleSpeech serves POST /v1/audio/speech, OpenAI's text-to-speech body:
// {"model": "openai/gpt-4o-mini-tts", "input": "...", "voice": "alloy"} -> audio.
func (s *Server) handleSpeech(c fiber.Ctx) error {
	var req connectors.SpeechRequest
	if err := json.Unmarshal(c.Body(), &req); err != nil || strings.TrimSpace(req.Input) == "" {
		return writeError(c, http.StatusBadRequest, "invalid request: input is required")
	}

	return s.serveDirect(c, "text-to-speech", s.capabilityTargets(req.Model, audioSupport(connectors.SpeechCapability)),
		func(ctx context.Context, at webAttempt) (func() error, core.Usage, error) {
			req.Model = at.Target.Model
			audio, err := connectors.Speech(ctx, at.Target.Provider, at.BaseURL, at.Creds, req)
			return func() error {
				c.Set(fiber.HeaderContentType, cmp.Or(audio.ContentType, "audio/mpeg"))
				return c.Status(http.StatusOK).Send(audio.Body)
			}, core.Usage{}, err
		})
}

// handleTranscription serves POST /v1/audio/transcriptions, OpenAI's
// multipart body (file, model, language, prompt) -> {"text": "..."}.
func (s *Server) handleTranscription(c fiber.Ctx) error {
	fh, err := c.FormFile("file")
	if err != nil {
		return writeError(c, http.StatusBadRequest, "invalid request: multipart field file is required")
	}
	f, err := fh.Open()
	if err != nil {
		return writeError(c, http.StatusBadRequest, "invalid request: unreadable file")
	}
	data, err := io.ReadAll(f)
	_ = f.Close()
	if err != nil {
		return writeError(c, http.StatusBadRequest, "invalid request: unreadable file")
	}
	req := connectors.TranscriptionRequest{
		Language: c.FormValue("language"),
		Prompt:   c.FormValue("prompt"),
		File:     data,
		Filename: fh.Filename,
		FileType: cmp.Or(fh.Header.Get(fiber.HeaderContentType), "application/octet-stream"),
	}

	return s.serveDirect(c, "speech-to-text", s.capabilityTargets(c.FormValue("model"), audioSupport(connectors.TranscriptionCapability)),
		func(ctx context.Context, at webAttempt) (func() error, core.Usage, error) {
			req.Model = at.Target.Model
			text, err := connectors.Transcribe(ctx, at.Target.Provider, at.BaseURL, at.Creds, req)
			return func() error { return c.Status(http.StatusOK).JSON(fiber.Map{"text": text}) }, core.Usage{}, err
		})
}

// providerSupport reports whether a provider serves a capability; custom
// marks an operator-added provider (not in the catalog).
type providerSupport func(slug string, spec providerSpec, custom bool) bool

// audioSupport admits the providers with an audio driver; an OpenAI-compatible
// custom provider serves both directions.
func audioSupport(capability string) providerSupport {
	return func(slug string, spec providerSpec, custom bool) bool {
		return connectors.SupportsAudio(slug, capability, custom && spec.Dialect == core.DialectOpenAI)
	}
}

// capabilityTargets resolves the request's model exactly like chat —
// provider/model, alias, or chain — keeping only the targets whose provider
// serves the capability.
func (s *Server) capabilityTargets(model string, supports providerSupport) func(context.Context) ([]target, string, error) {
	return func(ctx context.Context) ([]target, string, error) {
		res, err := s.resolveTargets(ctx, model)
		if err != nil {
			return nil, "", err
		}
		var out []target
		for _, t := range res.Targets {
			spec, ok := s.providerSpec(ctx, t.Provider)
			_, inCatalog := catalog.Lookup(t.Provider)
			if ok && supports(t.Provider, spec, !inCatalog) {
				out = append(out, t)
			}
		}
		return out, res.ChainName, nil
	}
}
