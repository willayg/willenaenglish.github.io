-- 001_create_auth_password_audit.sql
-- Creates a simple audit table to record easy-login and password actions.

CREATE TABLE IF NOT EXISTS auth_password_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NULL,
  actor TEXT NULL,
  source TEXT NOT NULL,
  ip TEXT NULL,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT NULL
);

CREATE INDEX IF NOT EXISTS auth_password_audit_user_id_idx ON auth_password_audit(user_id);
CREATE INDEX IF NOT EXISTS auth_password_audit_timestamp_idx ON auth_password_audit(timestamp);
