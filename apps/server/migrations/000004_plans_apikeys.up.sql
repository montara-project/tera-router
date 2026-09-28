-- Inbound API keys (argon2id verifier + sha-256 lookup index + envelope
-- encrypted copy for reveal) and budget plan templates they can inherit.
CREATE TABLE plans (
    id             TEXT PRIMARY KEY,
    name           text NOT NULL,
    description    text NOT NULL DEFAULT '',
    limit_micros   bigint NOT NULL DEFAULT 0,
    limit_tokens   bigint NOT NULL DEFAULT 0,
    period         text NOT NULL DEFAULT 'monthly',
    alert_pct      integer NOT NULL DEFAULT 80,
    hard_cutoff    boolean NOT NULL DEFAULT false,
    allowed_models TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(allowed_models)),
    rpm            integer,
    tpm            integer,
    concurrent     integer,
    created_at     DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at     DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE TABLE api_keys (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT REFERENCES users (id) ON DELETE SET NULL,
    plan_id             TEXT REFERENCES plans (id) ON DELETE SET NULL,
    name                text NOT NULL,
    key_hash            text NOT NULL,
    lookup_hash         text NOT NULL UNIQUE,
    display             text NOT NULL DEFAULT '',
    scopes              text NOT NULL DEFAULT '',
    disabled            boolean NOT NULL DEFAULT false,
    last_used_at        DATETIME,
    secret_wrapped_dek  text NOT NULL DEFAULT '',
    secret_ciphertext   text NOT NULL DEFAULT '',
    created_at          DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at          DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX idx_api_keys_plan_id ON api_keys (plan_id);
