-- =============================================
-- DATABASE SCHEMA VERIFICATION SCRIPT
-- Check existence of all tables used in the application
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. CHECK ALL TABLES EXISTENCE
-- =============================================
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM (
    VALUES 
        -- Core Platform
        ('users'),
        ('roles'),
        ('user_roles'),
        ('refresh_tokens'),
        ('password_reset_tokens'),
        ('system_settings'),
        ('document_sequences'),
        ('audit_logs'),
        ('schema_versions'),
        
        -- Products & Locations
        ('products'),
        ('locations'),
        
        -- Inventory
        ('inventory'),
        ('inventory_transactions'),
        ('inventory_items'),
        ('inventory_item_transactions'),
        
        -- BOM
        ('boms'),
        ('bom_materials'),
        ('bom_versions'),
        
        -- Supply Chain
        ('customers'),
        ('gate_entries'),
        ('gate_entry_items'),
        ('gate_entry_materials'),
        ('gate_exits'),
        ('finished_goods'),
        ('dispatch_orders'),
        ('dispatch_order_items'),
        
        -- Orders & WIP
        ('purchase_orders'),
        ('purchase_order_items'),
        ('workstations'),
        ('work_orders'),
        ('work_order_materials'),
        ('work_order_operations'),
        ('order_materials'),
        ('order_team_assignments'),
        ('qc_inspections'),
        ('qc_defects'),
        
        -- WIP Stages
        ('wip_stages'),
        ('product_stages'),
        ('config_stages'),
        ('order_stage_tracking'),
        ('wip_stage_metrics'),
        ('wip_stage_transfers'),
        ('stage_performance_history'),
        
        -- Shifts
        ('shifts'),
        
        -- Material Management
        ('material_transfers'),
        ('material_requests'),
        ('request_items'),
        ('material_requisitions'),
        ('material_requisition_items'),
        
        -- Alerts & Notifications
        ('stock_alerts'),
        ('stock_alerts_items'),
        ('wip_alert_config'),
        ('wip_alert_history'),
        ('wip_notification_log'),
        ('notifications'),
        
        -- Templates
        ('quick_request_templates')
) AS required_tables(table_name)
ORDER BY 
    CASE 
        WHEN table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
        THEN 1 
        ELSE 0 
    END,
    table_name;

-- =============================================
-- 2. CHECK FOR DUPLICATE/CONFLICTING TABLES
-- =============================================
SELECT 
    'Checking for gate_entry items vs materials conflict' as check_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_items')
        AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_materials')
        THEN 'CONFLICT: Both gate_entry_items and gate_entry_materials exist'
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_items')
        THEN 'WARNING: gate_entry_items exists but service uses gate_entry_materials'
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_materials')
        THEN 'OK: gate_entry_materials exists'
        ELSE 'MISSING: Neither table exists'
    END as status;

-- =============================================
-- 3. CHECK CRITICAL FOREIGN KEY REFERENCES
-- =============================================
SELECT 
    'Foreign Key Check' as check_type,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    CASE 
        WHEN confrelid::regclass::text IN (
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        ) THEN 'OK'
        ELSE 'BROKEN'
    END as status
FROM pg_constraint
WHERE contype = 'f'
AND connamespace = 'public'::regnamespace
ORDER BY status DESC, table_name;

-- =============================================
-- 4. CHECK VIEWS
-- =============================================
SELECT 
    viewname as view_name,
    'EXISTS' as status
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- =============================================
-- 5. CHECK FUNCTIONS
-- =============================================
SELECT 
    proname as function_name,
    'EXISTS' as status
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND prokind = 'f'
ORDER BY proname;

-- =============================================
-- 6. CHECK TRIGGERS
-- =============================================
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    'EXISTS' as status
FROM pg_trigger
WHERE tgrelid::regclass::text IN (
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
)
ORDER BY table_name, trigger_name;

-- =============================================
-- 7. CHECK INDEXES
-- =============================================
SELECT 
    schemaname,
    tablename,
    indexname,
    'EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =============================================
-- 8. SUMMARY REPORT
-- =============================================
SELECT 
    'SUMMARY' as report_section,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public') as total_views,
    (SELECT COUNT(DISTINCT proname) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prokind = 'f') as total_functions,
    (SELECT COUNT(*) FROM pg_trigger WHERE tgrelid::regclass::text IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')) as total_triggers;

-- =============================================
-- 9. CHECK SPECIFIC CRITICAL TABLES
-- =============================================
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
    critical_tables TEXT[] := ARRAY[
        'users', 'products', 'locations', 'inventory', 
        'purchase_orders', 'work_orders', 'material_transfers',
        'material_requests', 'wip_stages', 'notifications'
    ];
BEGIN
    FOREACH table_name IN ARRAY critical_tables
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE NOTICE 'CRITICAL: Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'SUCCESS: All critical tables exist';
    END IF;
END $$;
