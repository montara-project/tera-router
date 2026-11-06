-- Where each sign-in session was opened from, so the dashboard can list
-- active sessions and the user can revoke one they do not recognise.
ALTER TABLE refresh_tokens ADD COLUMN user_agent text NOT NULL DEFAULT '';
ALTER TABLE refresh_tokens ADD COLUMN ip_address text NOT NULL DEFAULT '';
