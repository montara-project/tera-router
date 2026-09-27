-- Inbound API keys (argon2id verifier + sha-256 lookup index + envelope
-- encrypted copy for reveal) and budget plan templates they can inherit.
CREATE TABLE plans (
    id             uuid PRIMARY KEY,
    name           text NOT NULL,
    description    text NOT NULL DEFAULT '',
    limit_micros   bigint NOT NULL DEFAULT 0,
    limit_tokens   bigint NOT NULL DEFAULT 0,
    period         text NOT NULL DEFAULT 'monthly',
    alert_pct      integer NOT NULL DEFAULT 80,
    hard_cutoff    boolean NOT NULL DEFAULT false,
    allowed_models text[] NOT NULL DEFAULT '{}',
    rpm            integer,
    tpm            integer,
    concurrent     integer,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
    id                  uuid PRIMARY KEY,
    user_id             uuid REFERENCES users (id) ON DELETE SET NULL,
    plan_id             uuid REFERENCES plans (id) ON DELETE SET NULL,
    name                text NOT NULL,
    key_hash            text NOT NULL,
    lookup_hash         text NOT NULL UNIQUE,
    display             text NOT NULL DEFAULT '',
    scopes              text NOT NULL DEFAULT '',
    disabled            boolean NOT NULL DEFAULT false,
    last_used_at        timestamptz,
    secret_wrapped_dek  text NOT NULL DEFAULT '',
    secret_ciphertext   text NOT NULL DEFAULT '',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX idx_api_keys_plan_id ON api_keys (plan_id);
