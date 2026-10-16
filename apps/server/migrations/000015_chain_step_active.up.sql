-- Chain steps gain a per-step active toggle, mirroring alias_targets.active.
-- An inactive step stays in the chain but the gateway skips it; the default
-- keeps every existing step routable.
ALTER TABLE chain_steps
    ADD COLUMN active boolean NOT NULL DEFAULT true;
