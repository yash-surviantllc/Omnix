-- =============================================
-- 001: CORE PLATFORM & AUTHENTICATION
-- Unified Migration for Omnix Manufacturing
-- =============================================

SET search_path TO public;

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CORE TABLES (USERS, ROLES, TOKENS)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    user_agent TEXT,
    client_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PLATFORM SETTINGS & AUDIT
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','ACCESS','UNKNOWN')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_ip INET,
    user_agent TEXT
);

CREATE TABLE IF NOT EXISTS schema_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    checksum VARCHAR(64),
    execution_time_ms INTEGER,
    error_message TEXT
);

-- 4. GLOBAL HELPERS
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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table_name) 
    AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = p_table_name AND indexname = p_index_name) THEN
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
    SELECT * INTO v_sequence FROM document_sequences WHERE document_type = p_document_type FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO document_sequences (document_type, next_sequence) VALUES (p_document_type, 2) RETURNING * INTO v_sequence;
        v_sequence_num := 1;
    ELSE
        v_reset := (v_sequence.reset_frequency = 'DAILY' AND (v_sequence.last_reset_date IS NULL OR v_sequence.last_reset_date < CURRENT_DATE)) OR
                   (v_sequence.reset_frequency = 'WEEKLY' AND (v_sequence.last_reset_date IS NULL OR v_sequence.last_reset_date < date_trunc('week', CURRENT_DATE))) OR
                   (v_sequence.reset_frequency = 'MONTHLY' AND (v_sequence.last_reset_date IS NULL OR v_sequence.last_reset_date < date_trunc('month', CURRENT_DATE))) OR
                   (v_sequence.reset_frequency = 'YEARLY' AND (v_sequence.last_reset_date IS NULL OR v_sequence.last_reset_date < date_trunc('year', CURRENT_DATE)));
        IF v_sequence.reset_frequency = 'NEVER' OR NOT v_reset THEN
            v_sequence_num := v_sequence.next_sequence;
            UPDATE document_sequences SET next_sequence = next_sequence + 1 WHERE document_type = p_document_type;
        ELSE
            v_sequence_num := 1;
            UPDATE document_sequences SET next_sequence = 2, last_reset_date = CURRENT_DATE WHERE document_type = p_document_type;
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

-- 5. INDEXES
SELECT ensure_index_exists('users', 'idx_users_email', 'CREATE INDEX idx_users_email ON users(email);');
SELECT ensure_index_exists('users', 'idx_users_username', 'CREATE INDEX idx_users_username ON users(username);');
SELECT ensure_index_exists('audit_logs', 'idx_audit_logs_record', 'CREATE INDEX idx_audit_logs_record ON audit_logs (record_id);');
SELECT ensure_index_exists('audit_logs', 'idx_audit_logs_changed_at', 'CREATE INDEX idx_audit_logs_changed_at ON audit_logs (changed_at);');

-- 6. SEED ESSENTIAL DATA (System roles only)
INSERT INTO roles (id, name, description, is_system_role)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin', 'System Administrator', TRUE),
    ('00000000-0000-0000-0000-000000000002', 'manager', 'Manager', TRUE),
    ('00000000-0000-0000-0000-000000000003', 'supervisor', 'Production Supervisor', TRUE),
    ('00000000-0000-0000-0000-000000000004', 'operator', 'Machine Operator', TRUE),
    ('00000000-0000-0000-0000-000000000005', 'inventory_clerk', 'Inventory Clerk', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, is_public, is_required, description)
VALUES
    ('company.name', 'Omnix Manufacturing', 'STRING', 'COMPANY', TRUE, TRUE, 'Company name'),
    ('inventory.low_stock_threshold', '10', 'NUMBER', 'INVENTORY', TRUE, TRUE, 'Low stock threshold percentage'),
    ('production.default_lead_time_days', '7', 'NUMBER', 'PRODUCTION', TRUE, TRUE, 'Default production lead time (days)')
ON CONFLICT (setting_key) DO NOTHING;
