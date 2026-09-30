-- Ordered fallback routing chains and first-class model alias pools.
CREATE TABLE chains (
    id                TEXT PRIMARY KEY,
    name              text NOT NULL UNIQUE,
    strategy          text NOT NULL DEFAULT 'priority',
    fallback_provider text NOT NULL DEFAULT '',
    fallback_model    text NOT NULL DEFAULT '',
    context_window    integer NOT NULL DEFAULT 0,
    enabled           boolean NOT NULL DEFAULT true,
    created_at        DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at        DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE TABLE chain_steps (
    id         TEXT PRIMARY KEY,
    chain_id   TEXT NOT NULL REFERENCES chains (id) ON DELETE CASCADE,
    position   integer NOT NULL,
    provider   text NOT NULL,
    model      text NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE INDEX idx_chain_steps_chain_id ON chain_steps (chain_id);

CREATE TABLE model_aliases (
    id             TEXT PRIMARY KEY,
    name           text NOT NULL UNIQUE,
    context_window integer NOT NULL DEFAULT 0,
    active         boolean NOT NULL DEFAULT true,
    created_at     DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at     DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE TABLE alias_targets (
    id         TEXT PRIMARY KEY,
    alias_id   TEXT NOT NULL REFERENCES model_aliases (id) ON DELETE CASCADE,
    position   integer NOT NULL,
    provider   text NOT NULL,
    model      text NOT NULL,
    active     boolean NOT NULL DEFAULT true,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE INDEX idx_alias_targets_alias_id ON alias_targets (alias_id);
