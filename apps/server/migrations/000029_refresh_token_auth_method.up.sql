-- How the session was opened ("password", "sso", "passkey"). reauthenticate
-- accepts a freshly SSO- or passkey-opened session in place of the password
-- an account linked to an identity provider may not have; '' predates the
-- column and never counts.
ALTER TABLE refresh_tokens
    ADD COLUMN auth_method TEXT NOT NULL DEFAULT '';
