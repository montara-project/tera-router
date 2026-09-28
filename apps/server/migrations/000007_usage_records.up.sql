-- One row per metered request. Populated by the gateway phase.
CREATE TABLE usage_records (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id        TEXT,
    account_id        TEXT,
    provider          text NOT NULL DEFAULT '',
    model             text NOT NULL DEFAULT '',
    client            text NOT NULL DEFAULT '',
    client_ip         text NOT NULL DEFAULT '',
    prompt_tokens     integer NOT NULL DEFAULT 0,
    completion_tokens integer NOT NULL DEFAULT 0,
    cached_tokens     integer NOT NULL DEFAULT 0,
    cache_write_tokens integer NOT NULL DEFAULT 0,
    reasoning_tokens  integer NOT NULL DEFAULT 0,
    cost_micros       bigint NOT NULL DEFAULT 0,
    cache_hit         boolean NOT NULL DEFAULT false,
    latency_ms        integer NOT NULL DEFAULT 0,
    ttft_ms           integer NOT NULL DEFAULT 0,
    failed            boolean NOT NULL DEFAULT false,
    error_kind        text NOT NULL DEFAULT '',
    error_status      integer NOT NULL DEFAULT 0,
    error_message     text NOT NULL DEFAULT '',
    created_at        DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE INDEX idx_usage_records_created_at ON usage_records (created_at);
CREATE INDEX idx_usage_records_api_key_id ON usage_records (api_key_id);
CREATE INDEX idx_usage_records_provider_model ON usage_records (provider, model);
