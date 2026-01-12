-- =============================================
-- OMNIX MANUFACTURING - CORE PLATFORM SCHEMA
-- =============================================
-- Contains only platform-level primitives used by all downstream modules.
-- Safe to run on legacy databases; all statements are idempotent.
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 2. CORE TABLES (USERS, ROLES, TOKENS)
-- =============================================

-- Create users table with all required fields
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    phone_number VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_ip INET,
    revoked_at TIMESTAMPTZ,
    revoked_by_ip INET,
    replaced_by_token UUID,
    user_agent TEXT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_ip INET,
    used_at TIMESTAMPTZ
);

-- =============================================
-- 3. PLATFORM SETTINGS & AUDIT
-- =============================================

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) NOT NULL DEFAULT 'STRING'
        CHECK (setting_type IN ('STRING','NUMBER','BOOLEAN','JSON','ARRAY','OBJECT','UUID')),
    category VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    validation_regex TEXT,
    allowed_values JSONB,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS document_sequences (
    document_type VARCHAR(50) PRIMARY KEY,
    prefix VARCHAR(50),
    suffix VARCHAR(50),
    sequence_format VARCHAR(20) NOT NULL DEFAULT '000000',
    next_sequence INTEGER NOT NULL DEFAULT 1,
    reset_frequency VARCHAR(20) NOT NULL DEFAULT 'NEVER'
        CHECK (reset_frequency IN ('NEVER','DAILY','WEEKLY','MONTHLY','YEARLY')),
    last_reset_date DATE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    operation VARCHAR(20) NOT NULL
        CHECK (operation IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','ACCESS')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_ip INET,
    user_agent TEXT
);

CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    checksum VARCHAR(64),
    execution_time_ms INTEGER,
    error_message TEXT
);

-- =============================================
-- 4. HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION update_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_operation TEXT;
    v_old_data JSONB := '{}'::jsonb;
    v_new_data JSONB := '{}'::jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_operation := 'CREATE';
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_operation := 'UPDATE';
        v_new_data := to_jsonb(NEW);
        v_old_data := to_jsonb(OLD);
    ELSE
        v_operation := 'DELETE';
        v_old_data := to_jsonb(OLD);
    END IF;

    INSERT INTO audit_logs (
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        changed_by,
        client_ip,
        user_agent
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE((CASE WHEN TG_OP = 'DELETE' THEN v_old_data->>'id' ELSE v_new_data->>'id' END)::UUID, gen_random_uuid()),
        v_operation,
        v_old_data,
        v_new_data,
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID,
        NULLIF(current_setting('app.client_ip', TRUE), '')::INET,
        NULLIF(current_setting('app.user_agent', TRUE), '')
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ensure_index_exists(
    p_table_name TEXT,
    p_index_name TEXT,
    p_index_sql TEXT
) RETURNS VOID AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = p_table_name
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = p_table_name
          AND indexname = p_index_name
    ) THEN
        EXECUTE p_index_sql;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_document_number(
    p_document_type VARCHAR(50),
    p_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS VARCHAR(100) AS $$
DECLARE
    v_sequence RECORD;
    v_sequence_num INT;
    v_length INT;
    v_doc VARCHAR(255);
    v_reset BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_sequence
    FROM document_sequences
    WHERE document_type = p_document_type
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO document_sequences (document_type, next_sequence)
        VALUES (p_document_type, 2)
        RETURNING * INTO v_sequence;
        v_sequence_num := 1;
    ELSE
        v_reset :=
            (v_sequence.reset_frequency = 'DAILY'   AND (v_sequence.last_reset_date IS NULL OR v_sequence.last_reset_date < CURRENT_DATE)) OR
            (v_sequence.reset_frequency = 'WEEKLY'  AND (v_sequence.last_reset_date IS NULL OR v_sequence.last_reset_date < date_trunc('week', CURRENT_DATE))) OR
            (v_sequence.reset_frequency = 'MONTHLY' AND (v_sequence.last_reset_date IS NULL OR v_sequence.last_reset_date < date_trunc('month', CURRENT_DATE))) OR
            (v_sequence.reset_frequency = 'YEARLY'  AND (v_sequence.last_reset_date IS NULL OR v_sequence.last_reset_date < date_trunc('year', CURRENT_DATE)));

        IF v_sequence.reset_frequency = 'NEVER' OR NOT v_reset THEN
            v_sequence_num := v_sequence.next_sequence;
            UPDATE document_sequences
            SET next_sequence = next_sequence + 1
            WHERE document_type = p_document_type;
        ELSE
            v_sequence_num := 1;
            UPDATE document_sequences
            SET next_sequence = 2,
                last_reset_date = CURRENT_DATE
            WHERE document_type = p_document_type;
        END IF;
    END IF;

    v_length := COALESCE(NULLIF(regexp_replace(v_sequence.sequence_format, '[^0-9]', '', 'g'), '')::INT, 6);
    v_doc := COALESCE(v_sequence.prefix, '') || LPAD(v_sequence_num::TEXT, v_length, '0') || COALESCE(v_sequence.suffix, '');
    v_doc := REPLACE(v_doc, '{YYYY}', TO_CHAR(p_date, 'YYYY'));
    v_doc := REPLACE(v_doc, '{YY}', TO_CHAR(p_date, 'YY'));
    v_doc := REPLACE(v_doc, '{MM}', TO_CHAR(p_date, 'MM'));
    v_doc := REPLACE(v_doc, '{DD}', TO_CHAR(p_date, 'DD'));
    v_doc := REPLACE(v_doc, '{SEQ}', LPAD(v_sequence_num::TEXT, v_length, '0'));
    RETURN v_doc;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 5. TRIGGERS (BASE TABLES ONLY)
-- =============================================

DO $$
DECLARE
    rec RECORD;
    updated_tables TEXT[] := ARRAY['users','roles','user_roles','refresh_tokens','password_reset_tokens','system_settings','document_sequences'];
    audited_tables TEXT[] := ARRAY['users','roles','user_roles','system_settings','document_sequences'];
BEGIN
    FOR rec IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.column_name = 'updated_at'
          AND c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.table_name = ANY(updated_tables)
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON %1$I;', rec.table_name);
        EXECUTE format('CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION update_timestamps();', rec.table_name);
    END LOOP;

    FOR rec IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name = ANY(audited_tables)
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s_trigger ON %1$I;', rec.table_name);
        EXECUTE format('CREATE TRIGGER audit_%1$s_trigger AFTER INSERT OR UPDATE OR DELETE ON %1$I FOR EACH ROW EXECUTE FUNCTION log_audit_event();', rec.table_name);
    END LOOP;
END$$;

-- =============================================
-- 6. INDEXES
-- =============================================

-- Users table indexes
SELECT ensure_index_exists('users', 'idx_users_email', 'CREATE INDEX idx_users_email ON users(email);');
SELECT ensure_index_exists('users', 'idx_users_username', 'CREATE INDEX idx_users_username ON users(username);');
SELECT ensure_index_exists('users', 'idx_users_is_active', 'CREATE INDEX idx_users_is_active ON users(is_active);');
SELECT ensure_index_exists('users', 'idx_users_full_name', 'CREATE INDEX idx_users_full_name ON users(full_name);');
SELECT ensure_index_exists('users', 'idx_users_phone', 'CREATE INDEX idx_users_phone ON users(phone);');
SELECT ensure_index_exists('users', 'idx_users_is_verified', 'CREATE INDEX idx_users_is_verified ON users(is_verified);');
SELECT ensure_index_exists('users', 'idx_users_created_at', 'CREATE INDEX idx_users_created_at ON users(created_at);');
SELECT ensure_index_exists('roles', 'idx_roles_name', 'CREATE INDEX idx_roles_name ON roles (LOWER(name));');
SELECT ensure_index_exists('user_roles', 'idx_user_roles_user', 'CREATE INDEX idx_user_roles_user ON user_roles (user_id);');
SELECT ensure_index_exists('user_roles', 'idx_user_roles_role', 'CREATE INDEX idx_user_roles_role ON user_roles (role_id);');
SELECT ensure_index_exists('refresh_tokens', 'idx_refresh_tokens_user', 'CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);');
SELECT ensure_index_exists('refresh_tokens', 'idx_refresh_tokens_token', 'CREATE INDEX idx_refresh_tokens_token ON refresh_tokens (token_hash);');
SELECT ensure_index_exists('password_reset_tokens', 'idx_password_reset_tokens_user', 'CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id);');
SELECT ensure_index_exists('password_reset_tokens', 'idx_password_reset_tokens_token', 'CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens (token_hash);');
SELECT ensure_index_exists('system_settings', 'idx_system_settings_key', 'CREATE UNIQUE INDEX idx_system_settings_key ON system_settings (setting_key);');
SELECT ensure_index_exists('system_settings', 'idx_system_settings_category', 'CREATE INDEX idx_system_settings_category ON system_settings (category);');

-- Ensure legacy audit_logs tables have required columns before indexing
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS action VARCHAR(20) DEFAULT 'UNKNOWN'
        CHECK (action IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','ACCESS','UNKNOWN')),
    ADD COLUMN IF NOT EXISTS operation VARCHAR(20) DEFAULT 'UNKNOWN'
        CHECK (operation IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','ACCESS','UNKNOWN')),
    ADD COLUMN IF NOT EXISTS old_values JSONB,
    ADD COLUMN IF NOT EXISTS new_values JSONB,
    ADD COLUMN IF NOT EXISTS changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS client_ip INET,
    ADD COLUMN IF NOT EXISTS user_agent TEXT;

UPDATE audit_logs
SET action = COALESCE(action, operation, 'UNKNOWN'),
    operation = COALESCE(operation, action, 'UNKNOWN')
WHERE action IS NULL OR operation IS NULL;

ALTER TABLE audit_logs
    ALTER COLUMN action SET DEFAULT 'UNKNOWN',
    ALTER COLUMN operation SET DEFAULT 'UNKNOWN';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'action'
    ) THEN
        EXECUTE 'ALTER TABLE audit_logs ALTER COLUMN action SET NOT NULL';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'operation'
    ) THEN
        EXECUTE 'ALTER TABLE audit_logs ALTER COLUMN operation SET NOT NULL';
    END IF;
END $$;

SELECT ensure_index_exists('audit_logs', 'idx_audit_logs_table', 'CREATE INDEX idx_audit_logs_table ON audit_logs (table_name);');
SELECT ensure_index_exists('audit_logs', 'idx_audit_logs_record', 'CREATE INDEX idx_audit_logs_record ON audit_logs (record_id);');
SELECT ensure_index_exists('audit_logs', 'idx_audit_logs_changed_by', 'CREATE INDEX idx_audit_logs_changed_by ON audit_logs (changed_by);');
SELECT ensure_index_exists('audit_logs', 'idx_audit_logs_changed_at', 'CREATE INDEX idx_audit_logs_changed_at ON audit_logs (changed_at);');

-- =============================================
-- 7. SEED DATA
-- =============================================

-- Ensure legacy roles table has new metadata columns
ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure legacy users table has required seed columns
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure legacy user_roles table has audit columns used by seed data
ALTER TABLE user_roles
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Disambiguate legacy admin duplicates so seed can run idempotently
UPDATE users
SET email = CONCAT(email, '.legacy.', id::text),
    username = CONCAT(username, '_legacy')
WHERE email = 'admin@omnix.com'
  AND id <> '00000000-0000-0000-0000-000000000001';

INSERT INTO roles (id, name, description, is_system_role, permissions, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin', 'System Administrator', TRUE, '[]', NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000002', 'manager', 'Manager', TRUE, '[]', NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000003', 'supervisor', 'Production Supervisor', TRUE, '[]', NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000004', 'operator', 'Machine Operator', TRUE, '[]', NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000005', 'inventory_clerk', 'Inventory Clerk', TRUE, '[]', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    is_system_role = EXCLUDED.is_system_role,
    updated_at = NOW();

INSERT INTO users (
    id, username, email, full_name, email_verified, password_hash,
    first_name, last_name, is_active, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@omnix.com',
    'System Administrator',
    TRUE,
    '$2b$12$S8S1mS1n2zsoZ7sPOtDZ2u5uOQ9zc3rroWAtxEvsC0Bpvy.buk..2',
    'System',
    'Administrator',
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO user_roles (user_id, role_id, created_at, created_by)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW(), '00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO document_sequences (document_type, prefix, sequence_format, reset_frequency, description)
VALUES
    ('PRODUCTION_ORDER', 'PO-{YYYY}-', '000000', 'YEARLY', 'Production order numbers'),
    ('WORK_ORDER', 'WO-{YYYY}-', '000000', 'YEARLY', 'Work order numbers'),
    ('GATE_ENTRY', 'GE-{YYYY}-', '000000', 'YEARLY', 'Gate entry numbers'),
    ('DISPATCH_ORDER', 'DO-{YYYY}-', '000000', 'YEARLY', 'Dispatch order numbers'),
    ('INVENTORY_TRANSFER', 'IT-{YYYY}-', '000000', 'YEARLY', 'Inventory transfer numbers'),
    ('STOCK_ADJUSTMENT', 'SA-{YYYY}-', '000000', 'YEARLY', 'Stock adjustment numbers')
ON CONFLICT (document_type) DO UPDATE SET
    prefix = EXCLUDED.prefix,
    sequence_format = EXCLUDED.sequence_format,
    reset_frequency = EXCLUDED.reset_frequency,
    description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, is_public, is_required, description)
VALUES
    ('company.name', 'Omnix Manufacturing', 'STRING', 'COMPANY', TRUE, TRUE, 'Company name'),
    ('company.address', '123 Industrial Area, City, Country', 'STRING', 'COMPANY', TRUE, TRUE, 'Company address'),
    ('company.contact_email', 'info@omnix.com', 'STRING', 'COMPANY', TRUE, TRUE, 'Company contact email'),
    ('company.contact_phone', '+1234567890', 'STRING', 'COMPANY', TRUE, TRUE, 'Company contact phone'),
    ('inventory.default_valuation_method', 'FIFO', 'STRING', 'INVENTORY', TRUE, TRUE, 'Default inventory valuation method'),
    ('inventory.low_stock_threshold', '10', 'NUMBER', 'INVENTORY', TRUE, TRUE, 'Low stock threshold percentage'),
    ('production.default_lead_time_days', '7', 'NUMBER', 'PRODUCTION', TRUE, TRUE, 'Default production lead time (days)'),
    ('alert.production_delay_threshold_hours', '4', 'NUMBER', 'ALERTS', TRUE, TRUE, 'Threshold in hours for production delay alerts')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    setting_type = EXCLUDED.setting_type,
    category = EXCLUDED.category,
    is_public = EXCLUDED.is_public,
    is_required = EXCLUDED.is_required,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =============================================
-- 8. FINALIZATION
-- =============================================

INSERT INTO schema_migrations (version, description, success, checksum, execution_time_ms)
VALUES (
    '0001_initial_consolidated_schema',
    'Initial consolidated database schema for Omnix Manufacturing',
    TRUE,
    'a1b2c3d4e5f6',
    0
)
ON CONFLICT (version) DO UPDATE SET
    description = EXCLUDED.description,
    success = EXCLUDED.success,
    checksum = EXCLUDED.checksum,
    execution_time_ms = EXCLUDED.execution_time_ms,
    installed_on = NOW();

DO $$
BEGIN
    RAISE NOTICE 'Core platform schema ensured at %', NOW();
    RAISE NOTICE 'Default admin user available (admin/admin123) - rotate credentials immediately in production.';
END$$;
