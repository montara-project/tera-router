-- SSO account linking: oidc_sub stores the IdP subject claim of the identity
-- that owns the account. Provisioned SSO users get it at insert; existing
-- accounts gain it on their first linked sign-in. Matching by sub survives
-- email changes at the provider. NULL means "password-only account".
ALTER TABLE users
    ADD COLUMN oidc_sub TEXT;

-- A subject identifies exactly one dashboard account; NULLs (unlinked rows)
-- do not collide.
CREATE UNIQUE INDEX idx_users_oidc_sub ON users (oidc_sub) WHERE oidc_sub IS NOT NULL;
