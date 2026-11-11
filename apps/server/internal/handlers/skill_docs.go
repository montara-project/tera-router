package handlers

import (
	"embed"
	"encoding/json"
	"strings"

	"tera-router/server/internal/app"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/models"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// referenceSkills are the built-in guides teaching an agent how to call this
// router, keyed by slug (<slug>.md). {{BASE_URL}} is filled in per request
// with the router's public address (see requestBaseURL).
//
//go:embed skilldocs/*.md
var referenceSkills embed.FS

// Document serves a skill as GET /skills/:slug/SKILL.md — the URL the
// dashboard's copy button hands to an AI agent. It is public because agents
// fetch it without credentials: reference guides hold nothing secret, and a
// custom skill is reachable only through its unguessable id.
func (h *skillsHandler) Document(c fiber.Ctx) error {
	slug := c.Params("slug")

	var doc string
	if ref, err := referenceSkills.ReadFile("skilldocs/" + slug + ".md"); err == nil {
		doc = strings.ReplaceAll(string(ref), "{{BASE_URL}}", requestBaseURL(c, h.app))
		// The guide tells an agent where to send its API key. Without a
		// configured address that comes from the request, so no cache may
		// hand one caller's copy to another.
		c.Set(fiber.HeaderCacheControl, "no-store")
	} else {
		id, err := uuid.Parse(slug)
		if err != nil {
			return apperr.ErrNotFound
		}
		skill, err := h.app.Repos.Skills.Get(c.Context(), id.String())
		if err != nil {
			return err
		}
		doc = renderSkill(skill)
	}

	c.Set(fiber.HeaderContentType, "text/markdown; charset=utf-8")
	return c.SendString(doc)
}

// renderSkill formats a custom skill as a SKILL.md: YAML frontmatter followed
// by the prompt. Name and description are JSON-quoted — a valid YAML scalar
// whatever characters the user typed.
func renderSkill(s models.Skill) string {
	name, _ := json.Marshal(s.Name)
	description, _ := json.Marshal(s.Description)
	return "---\nname: " + string(name) + "\ndescription: " + string(description) + "\n---\n\n" +
		strings.TrimSpace(s.Prompt) + "\n"
}

// requestBaseURL is the router's public origin: the configured API_URL when
// set, so documents that tell an agent where to send its API key never take
// that address from request headers. Without one it is the origin the client
// used. A TLS terminating proxy or the Cloudflare tunnel forwards plain HTTP,
// so X-Forwarded-Proto is honored there; the result only shapes a document
// sent back to the same caller.
func requestBaseURL(c fiber.Ctx, a *app.Application) string {
	if u := strings.TrimRight(a.Config.App.APIURL, "/"); u != "" {
		return u
	}
	scheme := c.Scheme()
	if p := c.Get(fiber.HeaderXForwardedProto); p == "http" || p == "https" {
		scheme = p
	}
	return scheme + "://" + c.Host()
}
