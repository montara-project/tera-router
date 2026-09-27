-- Spend/token budgets over a period, with lazy allocation counters.
CREATE TABLE budgets (
    id               uuid PRIMARY KEY,
    scope_kind       text NOT NULL,
    scope_id         text NOT NULL DEFAULT '',
    limit_micros     bigint NOT NULL DEFAULT 0,
    limit_tokens     bigint NOT NULL DEFAULT 0,
    period           text NOT NULL DEFAULT 'monthly',
    alert_pct        integer NOT NULL DEFAULT 80,
    hard_cutoff      boolean NOT NULL DEFAULT false,
    remaining_tokens bigint NOT NULL DEFAULT 0,
    remaining_micros bigint NOT NULL DEFAULT 0,
    period_bucket    text NOT NULL DEFAULT '',
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_budgets_scope ON budgets (scope_kind, scope_id);
