-- A double-submitted create raced past the GetByKeyHash precheck and landed
-- two accounts on the same credential, after which the dedup lookup only
-- ever found the older row. Rows already duplicated that way keep their
-- data but lose the dedup hash; the oldest row wins the key.
UPDATE accounts
SET key_hash = ''
WHERE key_hash != ''
  AND rowid NOT IN (
      SELECT MIN(rowid) FROM accounts WHERE key_hash != '' GROUP BY key_hash
  );

CREATE UNIQUE INDEX idx_accounts_key_hash
    ON accounts (key_hash)
    WHERE key_hash != '';
