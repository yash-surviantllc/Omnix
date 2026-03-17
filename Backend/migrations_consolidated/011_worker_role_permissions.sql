-- 011_worker_role_permissions.sql
-- Worker Role & Module-Scoped Permissions
-- =========================================
-- Adds the 'worker' role and a per-user module permission table
-- so that system admins can control which modules each worker can access.

-- 1. Seed the worker role
INSERT INTO roles (id, name, description, is_system_role)
VALUES ('00000000-0000-0000-0000-000000000006', 'worker', 'Worker – module-scoped, no delete', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Worker module permissions table
CREATE TABLE IF NOT EXISTS worker_module_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_key  VARCHAR(50) NOT NULL,
    granted_by  UUID NOT NULL REFERENCES users(id),
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_worker_module_permissions_user
    ON worker_module_permissions(user_id);
