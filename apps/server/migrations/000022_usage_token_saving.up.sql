-- Token-saving attribution per attempt, so the dashboard can report what the
-- optimizers did. prompt_reduced_bytes is how many bytes input compression
-- (Headroom and RTK) removed from the request; output_shaped marks requests
-- that carried an output-shaping directive (Caveman, Terse, Ponytail).
ALTER TABLE usage_records ADD COLUMN prompt_reduced_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN output_shaped INTEGER NOT NULL DEFAULT 0;
