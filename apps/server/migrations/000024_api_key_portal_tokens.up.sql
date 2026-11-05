-- Usage portal links: one revocable token per API key. Whoever holds the
-- token can read that key's usage without signing in, so it is separate from
-- the key id (which shows up in admin pages and audit rows) and can be
-- replaced or removed without touching the key itself.
CREATE TABLE api_key_portal_tokens (
    api_key_id TEXT PRIMARY KEY REFERENCES api_keys (id) ON DELETE CASCADE,
    token      text NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);
