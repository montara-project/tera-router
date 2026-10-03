-- Request attribution for provider health: usage rows already capture every
-- gateway attempt (success or failure, with provider/model/latency). The
-- request id groups the rows of one client request so fallbacks (a failed
-- attempt followed by a success elsewhere) can be told apart from final
-- failures (no success anywhere), and the chain column attributes traffic to
-- the routing chain that produced it.
ALTER TABLE usage_records ADD COLUMN request_id text NOT NULL DEFAULT '';
ALTER TABLE usage_records ADD COLUMN chain text NOT NULL DEFAULT '';

CREATE INDEX idx_usage_records_request_id ON usage_records (request_id);
