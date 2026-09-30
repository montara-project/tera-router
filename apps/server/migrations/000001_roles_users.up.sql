-- Roles and users for dashboard authentication.
CREATE TABLE roles (
    id         TEXT PRIMARY KEY,
    name       text NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now'))
);

CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    fullname      text NOT NULL DEFAULT '',
    email         text NOT NULL UNIQUE,
    phone         text,
    address       text,
    token_verify  text,
    password_hash text NOT NULL,
    is_active     boolean NOT NULL DEFAULT true,
    is_blocked    boolean NOT NULL DEFAULT false,
    role_id       TEXT NOT NULL REFERENCES roles (id),
    created_at    DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    updated_at    DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00', 'now')),
    deleted_at    DATETIME
);

CREATE INDEX idx_users_role_id ON users (role_id);
