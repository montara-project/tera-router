-- Guardrails: layered content-safety policies (global → provider → model →
-- chain → key). Config and protections are stored as opaque JSON so the
-- dashboard can evolve detector options without further migrations.
CREATE TABLE guardrail_policies (
    id          TEXT PRIMARY KEY,
    name        text NOT NULL,
    scope       text NOT NULL DEFAULT 'global',
    target      text NOT NULL DEFAULT '',
    protections TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(protections)),
    config      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(config)),
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at  DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE INDEX idx_guardrail_policies_scope ON guardrail_policies (scope, target);
