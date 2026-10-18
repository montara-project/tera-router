ALTER TABLE users DROP COLUMN totp_last_step;
ALTER TABLE users DROP COLUMN totp_ciphertext;
ALTER TABLE users DROP COLUMN totp_wrapped_dek;
