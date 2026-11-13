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

// clineQuotaProvider reports whether a provider's accounts expose a Cline
// credit balance. ClinePass is billed by subscription, not from the balance;
// its plan windows are not read yet.
func clineQuotaProvider(slug string) bool {
	return slug == "cline" || slug == "clinepayg"
}

// clineQuota answers Quota for a Cline pay-as-you-go account with the credit
// balance of the Cline account behind its key.
func (h *accountsHandler) clineQuota(c fiber.Ctx, account models.Account) error {
	key := ""
	var err error
	switch {
	case !account.Secret.Empty():
		key, err = h.app.Secrets.OpenString(account.Secret, sealer.PurposeAccountSecret)
	case !account.Token.Empty():
		key, err = h.app.Secrets.OpenString(account.Token, sealer.PurposeAccountToken)
	}
	if err != nil {
		return err
	}
	if key == "" {
		return apperr.New(apperr.KindUnprocessable, "this account has no credential stored")
	}

	spec, _ := catalog.Lookup(account.Provider)
	base := spec.BaseURL
	if u := metadataBaseURL(account.Metadata); u != "" {
		base = u
	}
	balance, err := h.app.Services.Upstream.ClineBalance(c.Context(), base, key)
	if err != nil {
		return apperr.New(apperr.KindUnprocessable, "%s", err.Error())
	}
	return dtos.OK(c, fiber.Map{
		"account_id":       account.ID,
		"quota_visibility": "upstream",
		"quota_note":       "Cline credit balance reported by Cline.",
		"windows":          []oauth.UsageWindow{},
		"credits":          balance,
		"fetched_at":       time.Now().UTC(),
	})
}
