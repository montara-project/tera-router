package handlers

import (
	"time"

	"tera-router/server/internal/catalog"
	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib/apperr"
	"tera-router/server/internal/lib/sealer"
	"tera-router/server/internal/models"
	"tera-router/server/internal/oauth"

	"github.com/gofiber/fiber/v3"
)

// buddyQuota answers Quota for one account of Tencent's buddy family with the
// credit packages its billing meter reports. The access token is refreshed
// first, so a stale session never makes the meter answer 401.
func (h *accountsHandler) buddyQuota(c fiber.Ctx, account models.Account) error {
	account, err := h.app.OAuth.EnsureFresh(c.Context(), account)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	token := ""
	switch {
	case account.AuthKind == models.AuthOAuth && !account.Token.Empty():
		// EnsureFresh rotated Token; a leftover Secret would be stale.
		token, err = h.app.Secrets.OpenString(account.Token, sealer.PurposeAccountToken)
	case !account.Secret.Empty():
		token, err = h.app.Secrets.OpenString(account.Secret, sealer.PurposeAccountSecret)
	case !account.Token.Empty():
		token, err = h.app.Secrets.OpenString(account.Token, sealer.PurposeAccountToken)
	}
	if err != nil {
		return err
	}
	if token == "" {
		return apperr.New(apperr.KindUnprocessable, "this account has no credential stored")
	}

	spec, _ := catalog.Lookup(account.Provider)
	base := spec.BaseURL
	if u := metadataBaseURL(account.Metadata); u != "" {
		base = u
	}
	packages, err := h.app.Services.Upstream.BuddyQuota(c.Context(), base, token, account.Provider)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	return dtos.OK(c, fiber.Map{
		"account_id":       account.ID,
		"quota_visibility": "upstream",
		"quota_note":       "Credit packages reported by the " + spec.Name + " billing meter.",
		"windows":          []oauth.UsageWindow{},
		"packages":         packages,
		"fetched_at":       time.Now().UTC(),
	})
}
