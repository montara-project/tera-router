-- Request context and a hash chain for the audit trail. Each new row stores
-- the hash of the row before it, so editing or deleting a row breaks the
-- chain. Rows written before this migration keep seq NULL and an empty hash:
-- they are still listed but are not part of the chain.
ALTER TABLE audit_entries ADD COLUMN outcome TEXT NOT NULL DEFAULT 'success';
ALTER TABLE audit_entries ADD COLUMN session_id TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_entries ADD COLUMN method TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_entries ADD COLUMN route TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_entries ADD COLUMN status INTEGER NOT NULL DEFAULT 0;
ALTER TABLE audit_entries ADD COLUMN client_ip TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_entries ADD COLUMN forwarded_for TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_entries ADD COLUMN user_agent TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_entries ADD COLUMN request_id TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_entries ADD COLUMN seq INTEGER;
ALTER TABLE audit_entries ADD COLUMN prev_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_entries ADD COLUMN hash TEXT NOT NULL DEFAULT '';

-- One row per position: a second writer racing for the same seq fails
-- instead of forking the chain. NULLs (legacy rows) do not collide.
CREATE UNIQUE INDEX idx_audit_entries_seq ON audit_entries (seq);
