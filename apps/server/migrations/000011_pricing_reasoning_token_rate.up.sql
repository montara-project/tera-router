-- Reasoning tokens get their own rate. Reasoning tokens are reported as a
-- subset of completion tokens (OpenAI completion_tokens_details, Responses
-- output_tokens_details), so when reasoning_micros is set the completion bill
-- splits: (completion - reasoning) at output_micros plus reasoning at
-- reasoning_micros. Zero keeps the old behavior: the whole completion is
-- billed at output_micros.
ALTER TABLE model_pricing_overrides
    ADD COLUMN reasoning_micros bigint NOT NULL DEFAULT 0;

-- Budget drain multiplier for token budgets (plans and hard-cutoff budgets).
-- NULL means no override: tokens drain 1:1. An explicit 0 marks the model as
-- free (drains no token budget); values > 1 amplify the drain. Cost budgets
-- and the stored cost_micros are never scaled. The rate is snapshotted onto
-- each usage_records row at request time, so budget sums stay stable when an
-- operator retunes the override mid-period.
ALTER TABLE model_pricing_overrides
    ADD COLUMN token_consumption_rate REAL;

ALTER TABLE usage_records
    ADD COLUMN token_consumption_rate REAL;
