-- WebAuthn passkeys for dashboard sign-in. credential holds the library's
-- credential record (public key, sign count, flags) as JSON; rp_id is the
-- host the passkey was made on and is the only host it works on.
CREATE TABLE passkeys (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    credential_id text NOT NULL UNIQUE,
    rp_id         text NOT NULL,
    name          text NOT NULL DEFAULT '',
    credential    text NOT NULL,
    last_used_at  DATETIME,
    created_at    DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE INDEX idx_passkeys_user_id ON passkeys (user_id);
