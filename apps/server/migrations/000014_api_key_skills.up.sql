-- Per-key skills: ids of the skills whose prompt the gateway appends to the
-- system prompt of requests made with this key, on top of the globally enabled
-- ones. Deleting a skill strips its id from every key in the same transaction.
ALTER TABLE api_keys
    ADD COLUMN skill_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(skill_ids));
