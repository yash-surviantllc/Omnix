-- =============================================
-- MIGRATION VALIDATION AND ROLLBACK SYSTEM
-- =============================================

-- 1. VERSION CONTROL ENHANCEMENT
-- =============================================

-- Add checksum calculation for migration validation
CREATE OR REPLACE FUNCTION calculate_migration_checksum(p_version VARCHAR)
RETURNS VARCHAR(64) AS $$
DECLARE
    v_checksum TEXT := '';
    rec RECORD;
BEGIN
    -- Calculate checksum based on all tables and their structures
    FOR rec IN
        SELECT
            t.table_name,
            string_agg(
                c.column_name || ':' || c.data_type ||
                COALESCE(':' || c.character_maximum_length::TEXT, '') ||
                COALESCE(':' || c.numeric_precision::TEXT || ',' || c.numeric_scale::TEXT, '') ||
                CASE WHEN c.is_nullable = 'NO' THEN ':NOT_NULL' ELSE '' END ||
                COALESCE(':' || c.column_default, ''),
                ';'
                ORDER BY c.ordinal_position
            ) as table_structure
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
            AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
            AND t.table_name NOT LIKE 'pg_%'
            AND t.table_name NOT LIKE 'sql_%'
        GROUP BY t.table_name
        ORDER BY t.table_name
    LOOP
        v_checksum := v_checksum || rec.table_name || ':' || rec.table_structure || '|';
    END LOOP;

    -- Return first 64 chars of hash
    RETURN substring(md5(v_checksum), 1, 64);
END;
$$ LANGUAGE plpgsql;

-- Enhanced schema versions table (already exists in 001)
-- Add validation function
CREATE OR REPLACE FUNCTION validate_schema_version(p_version VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_expected_checksum VARCHAR(64);
    v_current_checksum VARCHAR(64);
BEGIN
    -- Get expected checksum from schema_versions
    SELECT checksum INTO v_expected_checksum
    FROM schema_versions
    WHERE version = p_version AND success = TRUE
    ORDER BY installed_on DESC
    LIMIT 1;

    IF v_expected_checksum IS NULL THEN
        RETURN TRUE; -- No checksum stored yet
    END IF;

    -- Calculate current checksum
    SELECT calculate_migration_checksum(p_version) INTO v_current_checksum;

    -- Compare checksums
    RETURN v_expected_checksum = v_current_checksum;
END;
$$ LANGUAGE plpgsql;

-- 2. MIGRATION VALIDATION FUNCTIONS
-- =============================================

-- Comprehensive migration validation
CREATE OR REPLACE FUNCTION validate_migration_state()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    v_table_count INTEGER;
    v_index_count INTEGER;
    v_constraint_count INTEGER;
    v_fk_count INTEGER;
    v_function_count INTEGER;
    v_trigger_count INTEGER;
BEGIN
    -- Check required tables exist
    SELECT COUNT(*) INTO v_table_count
    FROM (
        VALUES
            ('users'), ('roles'), ('user_roles'), ('refresh_tokens'),
            ('password_reset_tokens'), ('system_settings'), ('document_sequences'),
            ('schema_versions'), ('audit_logs'), ('products'), ('locations'),
            ('inventory'), ('inventory_transactions'), ('inventory_items'),
            ('bom_materials'), ('boms'), ('purchase_orders'), ('work_orders'),
            ('work_order_materials'), ('finished_goods'), ('gate_entries'),
            ('customers'), ('dispatch_orders')
    ) AS required_tables(table_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = required_tables.table_name
    );

    RETURN QUERY SELECT
        'Required Tables'::TEXT,
        CASE WHEN v_table_count = 0 THEN 'PASS' ELSE 'FAIL' END,
        format('%s missing tables', v_table_count)::TEXT;

    -- Check foreign key constraints
    SELECT COUNT(*) INTO v_fk_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';

    RETURN QUERY SELECT
        'Foreign Key Constraints'::TEXT,
        CASE WHEN v_fk_count >= 20 THEN 'PASS' ELSE 'WARN' END,
        format('%s foreign key constraints found', v_fk_count)::TEXT;

    -- Check indexes
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%';

    RETURN QUERY SELECT
        'Database Indexes'::TEXT,
        CASE WHEN v_index_count >= 50 THEN 'PASS' ELSE 'WARN' END,
        format('%s indexes found', v_index_count)::TEXT;

    -- Check functions
    SELECT COUNT(*) INTO v_function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION';

    RETURN QUERY SELECT
        'Database Functions'::TEXT,
        CASE WHEN v_function_count >= 10 THEN 'PASS' ELSE 'WARN' END,
        format('%s functions found', v_function_count)::TEXT;

    -- Check triggers
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public';

    RETURN QUERY SELECT
        'Database Triggers'::TEXT,
        CASE WHEN v_trigger_count >= 15 THEN 'PASS' ELSE 'WARN' END,
        format('%s triggers found', v_trigger_count)::TEXT;

    -- Check data integrity
    RETURN QUERY SELECT
        'Data Integrity'::TEXT,
        CASE
            WHEN (
                SELECT COUNT(*) FROM users WHERE email IS NULL OR username IS NULL
            ) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Users table integrity check'::TEXT;

END;
$$ LANGUAGE plpgsql;

-- 3. ROLLBACK PROCEDURES
-- =============================================

-- Generic rollback function
CREATE OR REPLACE PROCEDURE rollback_migration(p_version VARCHAR)
LANGUAGE plpgsql
AS $$
DECLARE
    v_rollback_sql TEXT;
    v_success BOOLEAN := FALSE;
BEGIN
    -- Start transaction for rollback
    BEGIN
        CASE p_version
            WHEN '001' THEN
                -- Rollback initial schema
                v_rollback_sql := '
                    DROP TABLE IF EXISTS audit_logs CASCADE;
                    DROP TABLE IF EXISTS document_sequences CASCADE;
                    DROP TABLE IF EXISTS system_settings CASCADE;
                    DROP TABLE IF EXISTS password_reset_tokens CASCADE;
                    DROP TABLE IF EXISTS refresh_tokens CASCADE;
                    DROP TABLE IF EXISTS user_roles CASCADE;
                    DROP TABLE IF EXISTS roles CASCADE;
                    DROP TABLE IF EXISTS users CASCADE;
                    DROP TABLE IF EXISTS schema_versions CASCADE;
                    DROP EXTENSION IF EXISTS pgcrypto;
                    DROP EXTENSION IF EXISTS "uuid-ossp";
                ';

            WHEN '002' THEN
                -- Rollback inventory and products
                v_rollback_sql := '
                    DROP TABLE IF EXISTS bom_versions CASCADE;
                    DROP TABLE IF EXISTS bom_materials CASCADE;
                    DROP TABLE IF EXISTS boms CASCADE;
                    DROP TABLE IF EXISTS stock_alerts_items CASCADE;
                    DROP TABLE IF EXISTS inventory_item_transactions CASCADE;
                    DROP TABLE IF EXISTS inventory_items CASCADE;
                    DROP TABLE IF EXISTS inventory_transactions CASCADE;
                    DROP TABLE IF EXISTS inventory CASCADE;
                    DROP TABLE IF EXISTS locations CASCADE;
                    DROP TABLE IF EXISTS products CASCADE;
                ';

            WHEN '003' THEN
                -- Rollback purchase and work orders
                v_rollback_sql := '
                    DROP TABLE IF EXISTS order_team_assignments CASCADE;
                    DROP TABLE IF EXISTS order_materials CASCADE;
                    DROP TABLE IF EXISTS work_order_quality_checks CASCADE;
                    DROP TABLE IF EXISTS work_order_operations CASCADE;
                    DROP TABLE IF EXISTS work_order_materials CASCADE;
                    DROP TABLE IF EXISTS work_orders CASCADE;
                    DROP TABLE IF EXISTS purchase_order_items CASCADE;
                    DROP TABLE IF EXISTS purchase_orders CASCADE;
                    DROP TABLE IF EXISTS stage_performance_history CASCADE;
                    DROP TABLE IF EXISTS wip_stage_metrics CASCADE;
                ';

            WHEN '004' THEN
                -- Rollback alerts and monitoring
                v_rollback_sql := '
                    DROP TABLE IF EXISTS notification_logs CASCADE;
                    DROP TABLE IF EXISTS alert_suppressions CASCADE;
                    DROP TABLE IF EXISTS alert_history CASCADE;
                    DROP TABLE IF EXISTS alert_rules CASCADE;
                    DROP TABLE IF EXISTS alert_configs CASCADE;
                ';

            WHEN '005' THEN
                -- Rollback gate entries and finished goods
                v_rollback_sql := '
                    DROP TABLE IF EXISTS dispatch_allocations CASCADE;
                    DROP TABLE IF EXISTS dispatch_order_items CASCADE;
                    DROP TABLE IF EXISTS dispatch_orders CASCADE;
                    DROP TABLE IF EXISTS customers CASCADE;
                    DROP TABLE IF EXISTS finished_goods CASCADE;
                    DROP TABLE IF EXISTS gate_entry_items CASCADE;
                    DROP TABLE IF EXISTS gate_entries CASCADE;
                ';

            WHEN '006' THEN
                -- Rollback work orders consolidated (clean up any duplicates)
                v_rollback_sql := '
                    -- This migration is additive, no destructive rollback needed
                    -- Just mark as rolled back in schema_versions
                ';

            ELSE
                RAISE EXCEPTION 'Unknown migration version: %', p_version;
        END CASE;

        -- Execute rollback SQL if provided
        IF v_rollback_sql IS NOT NULL AND v_rollback_sql != '' THEN
            EXECUTE v_rollback_sql;
        END IF;

        -- Update schema_versions to mark as rolled back
        UPDATE schema_versions
        SET success = FALSE,
            error_message = 'Rolled back on ' || NOW()
        WHERE version = p_version;

        v_success := TRUE;

        RAISE NOTICE 'Successfully rolled back migration version %', p_version;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Rollback failed for version %: %', p_version, SQLERRM;
    END;
END;
$$;

-- Safe migration application function
CREATE OR REPLACE FUNCTION apply_migration_safely(
    p_version VARCHAR,
    p_description TEXT,
    p_migration_sql TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_execution_time_ms BIGINT;
    v_checksum VARCHAR(64);
BEGIN
    v_start_time := clock_timestamp();

    BEGIN
        -- Execute the migration
        EXECUTE p_migration_sql;

        -- Calculate execution time
        v_end_time := clock_timestamp();
        v_execution_time_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

        -- Calculate checksum
        v_checksum := calculate_migration_checksum(p_version);

        -- Record successful migration
        INSERT INTO schema_versions (
            version, description, success, checksum,
            execution_time_ms, installed_on
        ) VALUES (
            p_version, p_description, TRUE, v_checksum,
            v_execution_time_ms, NOW()
        )
        ON CONFLICT (version) DO UPDATE SET
            description = EXCLUDED.description,
            success = TRUE,
            checksum = EXCLUDED.checksum,
            execution_time_ms = EXCLUDED.execution_time_ms,
            installed_on = NOW();

        RAISE NOTICE 'Migration % applied successfully in % ms', p_version, v_execution_time_ms;
        RETURN TRUE;

    EXCEPTION WHEN OTHERS THEN
        -- Record failed migration
        INSERT INTO schema_versions (
            version, description, success, error_message, installed_on
        ) VALUES (
            p_version, p_description, FALSE, SQLERRM, NOW()
        )
        ON CONFLICT (version) DO UPDATE SET
            success = FALSE,
            error_message = SQLERRM,
            installed_on = NOW();

        RAISE EXCEPTION 'Migration % failed: %', p_version, SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- USAGE EXAMPLES
-- =============================================

/*
-- Validate current migration state:
SELECT * FROM validate_migration_state();

-- Check if a specific version is valid:
SELECT validate_schema_version('001');

-- Apply a migration safely:
SELECT apply_migration_safely(
    '007',
    'New feature migration',
    'CREATE TABLE IF NOT EXISTS example (id UUID PRIMARY KEY);'
);

-- Rollback a migration:
CALL rollback_migration('007');
*/

-- =============================================
-- FINAL VALIDATION
-- =============================================

DO $$
DECLARE
    validation_result RECORD;
    all_passed BOOLEAN := TRUE;
BEGIN
    RAISE NOTICE 'Running final migration validation...';

    FOR validation_result IN SELECT * FROM validate_migration_state() LOOP
        RAISE NOTICE '%: % - %', validation_result.check_name, validation_result.status, validation_result.details;
        IF validation_result.status = 'FAIL' THEN
            all_passed := FALSE;
        END IF;
    END LOOP;

    IF all_passed THEN
        RAISE NOTICE '✓ All migration validations passed!';
    ELSE
        RAISE WARNING '⚠️  Some migration validations failed. Check logs above.';
    END IF;
END $$;
