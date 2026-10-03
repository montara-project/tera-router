DROP INDEX IF EXISTS idx_usage_records_request_id;
ALTER TABLE usage_records DROP COLUMN request_id;
ALTER TABLE usage_records DROP COLUMN chain;
