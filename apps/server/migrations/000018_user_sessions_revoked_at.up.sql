-- Access tokens are stateless JWTs; this timestamp lets the server refuse
-- every one issued before it (sign-out, password/email change, TOTP reset).
ALTER TABLE users ADD COLUMN sessions_revoked_at DATETIME;
