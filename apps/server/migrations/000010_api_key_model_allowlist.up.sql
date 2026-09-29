-- Per-key model allowlist. An empty list means the key follows its assigned
-- plan untouched; a non-empty list narrows the key to the intersection of this
-- list and the plan's allowed_models. Patterns match plans.allowed_models:
-- bare model ids, provider/model, "chain:name", and trailing-* wildcards.
ALTER TABLE api_keys
    ADD COLUMN allowed_models TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(allowed_models));
