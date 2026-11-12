-- The pair index tolerates two issuers sharing a subject; the single-column
-- one restored below cannot. Keep the oldest row's link, clear the rest —
-- every user row survives, and a cleared account re-links by email on its
-- next sign-in.
UPDATE users SET oidc_sub = NULL
WHERE oidc_sub IS NOT NULL AND rowid NOT IN (
    SELECT MIN(rowid) FROM users WHERE oidc_sub IS NOT NULL GROUP BY oidc_sub);

DROP INDEX idx_users_oidc_iss_sub;
CREATE UNIQUE INDEX idx_users_oidc_sub ON users (oidc_sub) WHERE oidc_sub IS NOT NULL;
ALTER TABLE users DROP COLUMN oidc_iss;
