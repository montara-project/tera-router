-- Optional TOTP second factor for dashboard sign-in. The secret is sealed like
-- every other credential; an empty ciphertext means TOTP is off. last_step is
-- the newest 30-second step accepted, so a code cannot be replayed.
ALTER TABLE users ADD COLUMN totp_wrapped_dek text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_ciphertext text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_last_step integer NOT NULL DEFAULT 0;
