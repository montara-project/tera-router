-- Custom (operator-registered) OpenAI-compatible upstream providers and the
-- upstream credential accounts that belong to provider slugs. Secret material
-- is stored as envelope-encrypted blobs (wrapped DEK + ciphertext).
CREATE TABLE custom_providers (
    id         uuid PRIMARY KEY,
    name       text NOT NULL,
    slug       text NOT NULL UNIQUE,
    base_url   text NOT NULL DEFAULT '',
    api_kind   text NOT NULL DEFAULT 'openai',
    pricing    jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled    boolean NOT NULL DEFAULT true,
    priority   integer NOT NULL DEFAULT 100,
    metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    id                  uuid PRIMARY KEY,
    provider            text NOT NULL,
    label               text NOT NULL DEFAULT '',
    auth_kind           text NOT NULL DEFAULT 'api_key',
    secret_wrapped_dek  text NOT NULL DEFAULT '',
    secret_ciphertext   text NOT NULL DEFAULT '',
    key_fingerprint     text NOT NULL DEFAULT '',
    key_hash            text NOT NULL DEFAULT '',
    token_wrapped_dek   text NOT NULL DEFAULT '',
    token_ciphertext    text NOT NULL DEFAULT '',
    refresh_wrapped_dek text NOT NULL DEFAULT '',
    refresh_ciphertext  text NOT NULL DEFAULT '',
    token_expires_at    timestamptz,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    priority            integer NOT NULL DEFAULT 100,
    disabled            boolean NOT NULL DEFAULT false,
    proxy_pool_id       uuid,
    needs_reconnect     boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_provider ON accounts (provider);
CREATE INDEX idx_accounts_proxy_pool ON accounts (proxy_pool_id);
