-- Proxy pools, skills, settings kv, audit trail, and per-model overrides.
CREATE TABLE proxy_pools (
    id             TEXT PRIMARY KEY,
    name           text NOT NULL,
    url            text NOT NULL,
    mode           text NOT NULL DEFAULT '',
    label          text NOT NULL DEFAULT '',
    status         text NOT NULL DEFAULT 'active',
    last_tested_at DATETIME,
    created_at     DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at     DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE TABLE skills (
    id          TEXT PRIMARY KEY,
    name        text NOT NULL,
    description text NOT NULL DEFAULT '',
    prompt      text NOT NULL DEFAULT '',
    created_at  DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at  DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE TABLE settings (
    key        text PRIMARY KEY,
    value      TEXT NOT NULL CHECK (json_valid(value)),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE TABLE audit_entries (
    id         TEXT PRIMARY KEY,
    actor      text NOT NULL DEFAULT '',
    action     text NOT NULL DEFAULT '',
    target     text NOT NULL DEFAULT '',
    detail     TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail)),
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE INDEX idx_audit_entries_created_at ON audit_entries (created_at);

CREATE TABLE model_pricing_overrides (
    id                 TEXT PRIMARY KEY,
    provider           text NOT NULL,
    model              text NOT NULL DEFAULT '',
    input_micros       bigint NOT NULL DEFAULT 0,
    output_micros      bigint NOT NULL DEFAULT 0,
    cache_read_micros  bigint NOT NULL DEFAULT 0,
    cache_write_micros bigint NOT NULL DEFAULT 0,
    created_at         DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at         DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    UNIQUE (provider, model)
);

CREATE TABLE model_capability_overrides (
    id           TEXT PRIMARY KEY,
    provider     text NOT NULL,
    model        text NOT NULL DEFAULT '',
    capabilities TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(capabilities)),
    created_at   DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at   DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    UNIQUE (provider, model)
);
