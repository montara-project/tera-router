-- Free-form label the model alias page groups aliases under; empty means
-- ungrouped. Routing ignores it.
ALTER TABLE model_aliases ADD COLUMN group_name text NOT NULL DEFAULT '';
