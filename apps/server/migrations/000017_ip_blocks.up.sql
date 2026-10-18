-- Client addresses refused at the edge. Manual entries are permanent
-- (expires_at NULL); repeated failed sign-ins add a temporary one.
CREATE TABLE ip_blocks (
    id         TEXT PRIMARY KEY,
    cidr       text NOT NULL UNIQUE,
    reason     text NOT NULL DEFAULT '',
    expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);
