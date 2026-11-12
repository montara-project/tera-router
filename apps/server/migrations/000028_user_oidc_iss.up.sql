-- A subject is only unique within its issuer: a deployment repointed at a
-- different provider could otherwise let that provider's colliding subs take
-- over existing links. oidc_iss records which issuer the subject belongs to;
-- lookups match the pair. Rows linked before this column existed keep a NULL
-- issuer until their next sign-in fills it.
ALTER TABLE users
    ADD COLUMN oidc_iss TEXT;

DROP INDEX idx_users_oidc_sub;
CREATE UNIQUE INDEX idx_users_oidc_iss_sub ON users (oidc_iss, oidc_sub) WHERE oidc_sub IS NOT NULL;
