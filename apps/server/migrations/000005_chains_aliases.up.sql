-- Ordered fallback routing chains and first-class model alias pools.
CREATE TABLE chains (
    id                uuid PRIMARY KEY,
    name              text NOT NULL UNIQUE,
    strategy          text NOT NULL DEFAULT 'priority',
    fallback_provider text NOT NULL DEFAULT '',
    fallback_model    text NOT NULL DEFAULT '',
    context_window    integer NOT NULL DEFAULT 0,
    enabled           boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chain_steps (
    id         uuid PRIMARY KEY,
    chain_id   uuid NOT NULL REFERENCES chains (id) ON DELETE CASCADE,
    position   integer NOT NULL,
    provider   text NOT NULL,
    model      text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chain_steps_chain_id ON chain_steps (chain_id);

CREATE TABLE model_aliases (
    id             uuid PRIMARY KEY,
    name           text NOT NULL UNIQUE,
    context_window integer NOT NULL DEFAULT 0,
    active         boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alias_targets (
    id         uuid PRIMARY KEY,
    alias_id   uuid NOT NULL REFERENCES model_aliases (id) ON DELETE CASCADE,
    position   integer NOT NULL,
    provider   text NOT NULL,
    model      text NOT NULL,
    active     boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alias_targets_alias_id ON alias_targets (alias_id);
