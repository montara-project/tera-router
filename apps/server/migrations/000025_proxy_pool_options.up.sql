-- Per-pool routing options: hosts that skip the proxy, an off switch, and
-- strict mode (fail the account instead of connecting directly when the
-- proxy is unreachable).
ALTER TABLE proxy_pools ADD COLUMN bypass TEXT NOT NULL DEFAULT '';
ALTER TABLE proxy_pools ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE proxy_pools ADD COLUMN strict INTEGER NOT NULL DEFAULT 0;
