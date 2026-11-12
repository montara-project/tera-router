DROP INDEX idx_users_oidc_iss_sub;
CREATE UNIQUE INDEX idx_users_oidc_sub ON users (oidc_sub) WHERE oidc_sub IS NOT NULL;
ALTER TABLE users DROP COLUMN oidc_iss;
