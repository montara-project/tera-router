-- Skills gain a gateway-injection toggle. An enabled skill's prompt is appended
-- to the system prompt of every inference request; the default keeps existing
-- skills as plain documents so the migration changes no request.
ALTER TABLE skills
    ADD COLUMN enabled boolean NOT NULL DEFAULT false;
