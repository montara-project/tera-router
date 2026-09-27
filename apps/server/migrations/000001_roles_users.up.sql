-- Roles and users for dashboard authentication.
CREATE TABLE roles (
    id         uuid PRIMARY KEY,
    name       text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id            uuid PRIMARY KEY,
    fullname      text NOT NULL DEFAULT '',
    email         text NOT NULL UNIQUE,
    phone         text,
    address       text,
    token_verify  text,
    password_hash text NOT NULL,
    is_active     boolean NOT NULL DEFAULT true,
    is_blocked    boolean NOT NULL DEFAULT false,
    role_id       uuid NOT NULL REFERENCES roles (id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz
);

CREATE INDEX idx_users_role_id ON users (role_id);
