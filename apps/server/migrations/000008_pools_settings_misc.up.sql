-- Proxy pools, skills, settings kv, audit trail, and per-model overrides.
CREATE TABLE proxy_pools (
    id             uuid PRIMARY KEY,
    name           text NOT NULL,
    url            text NOT NULL,
    mode           text NOT NULL DEFAULT '',
    label          text NOT NULL DEFAULT '',
    status         text NOT NULL DEFAULT 'active',
    last_tested_at timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skills (
    id          uuid PRIMARY KEY,
    name        text NOT NULL,
    description text NOT NULL DEFAULT '',
    prompt      text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
    key        text PRIMARY KEY,
    value      jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_entries (
    id         uuid PRIMARY KEY,
    actor      text NOT NULL DEFAULT '',
    action     text NOT NULL DEFAULT '',
    target     text NOT NULL DEFAULT '',
    detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entries_created_at ON audit_entries (created_at);

CREATE TABLE model_pricing_overrides (
    id                 uuid PRIMARY KEY,
    provider           text NOT NULL,
    model              text NOT NULL DEFAULT '',
    input_micros       bigint NOT NULL DEFAULT 0,
    output_micros      bigint NOT NULL DEFAULT 0,
    cache_read_micros  bigint NOT NULL DEFAULT 0,
    cache_write_micros bigint NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, model)
);

CREATE TABLE model_capability_overrides (
    id           uuid PRIMARY KEY,
    provider     text NOT NULL,
    model        text NOT NULL DEFAULT '',
    capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, model)
);
