-- =============================================
-- COMPREHENSIVE DATABASE HEALTH CHECK
-- Final verification after migration 008
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. TABLE EXISTENCE CHECK
-- =============================================
SELECT '=== TABLE EXISTENCE CHECK ===' as section;

SELECT 
    table_name,
    CASE 
        WHEN table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
        THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM (VALUES 
    -- Core
    ('users'), ('roles'), ('user_roles'),
    -- Products & Locations
    ('products'), ('locations'),
    -- Inventory
    ('inventory'), ('inventory_items'), ('inventory_transactions'), ('inventory_item_transactions'),
    -- BOM
    ('boms'), ('bom_materials'), ('bom_versions'),
    -- Orders
    ('purchase_orders'), ('purchase_order_items'), ('work_orders'), ('work_order_materials'), ('work_order_operations'),
    -- Material Management
    ('material_transfers'), ('material_requests'), ('request_items'),
    ('material_requisitions'), ('material_requisition_items'),
    -- Gate
    ('gate_entries'), ('gate_entry_materials'), ('gate_exits'),
    -- WIP
    ('wip_stages'), ('wip_stage_transfers'), ('product_stages'), ('config_stages'),
    -- QC
    ('qc_inspections'), ('qc_defects'),
    -- Alerts & Notifications
    ('stock_alerts'), ('stock_alerts_items'), ('notifications'),
    -- Other
    ('shifts'), ('customers'), ('finished_goods'), ('order_team_assignments'), ('quick_request_templates')
) AS t(table_name)
ORDER BY status, table_name;

-- =============================================
-- 2. FOREIGN KEY HEALTH
-- =============================================
SELECT '=== FOREIGN KEY HEALTH ===' as section;

SELECT 
    COUNT(*) as total_foreign_keys,
    COUNT(*) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM pg_tables pt
            WHERE pt.schemaname = 'public' 
            AND pt.tablename = ccu.table_name
        )
    ) as valid_keys,
    COUNT(*) FILTER (
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_tables pt
            WHERE pt.schemaname = 'public' 
            AND pt.tablename = ccu.table_name
        )
    ) as broken_keys
FROM information_schema.table_constraints AS tc
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';

-- =============================================
-- 3. INDEX COUNT
-- =============================================
SELECT '=== INDEX HEALTH ===' as section;

SELECT 
    COUNT(*) as total_indexes,
    COUNT(DISTINCT tablename) as tables_with_indexes
FROM pg_indexes
WHERE schemaname = 'public';

-- =============================================
-- 4. TRIGGER COUNT
-- =============================================
SELECT '=== TRIGGER HEALTH ===' as section;

SELECT 
    COUNT(*) as total_triggers,
    COUNT(DISTINCT tgrelid::regclass) as tables_with_triggers
FROM pg_trigger
WHERE tgrelid::regclass::text IN (
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
);

-- =============================================
-- 5. FUNCTION COUNT
-- =============================================
SELECT '=== FUNCTION HEALTH ===' as section;

SELECT 
    COUNT(*) as total_functions
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND prokind = 'f';

-- =============================================
-- 6. CRITICAL TABLES ROW COUNT
-- =============================================
SELECT '=== DATA PRESENCE CHECK ===' as section;

DO $$
DECLARE
    r RECORD;
    row_count INTEGER;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'products', 'locations', 'purchase_orders', 'work_orders')
        ORDER BY tablename
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
        RAISE NOTICE '% : % rows', r.tablename, row_count;
    END LOOP;
END $$;

-- =============================================
-- 7. FINAL SUMMARY
-- =============================================
SELECT '=== FINAL SUMMARY ===' as section;

SELECT 
    'Database Health' as metric,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public') as total_views,
    (SELECT COUNT(DISTINCT proname) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prokind = 'f') as total_functions,
    (SELECT COUNT(*) FROM pg_trigger WHERE tgrelid::regclass::text IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')) as total_triggers,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes;

-- =============================================
-- 8. POTENTIAL ISSUES
-- =============================================
SELECT '=== POTENTIAL ISSUES ===' as section;

-- Check for gate_entry conflict
SELECT 
    'Gate Entry Tables' as issue_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_items')
        AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_materials')
        THEN '⚠ CONFLICT: Both gate_entry_items and gate_entry_materials exist'
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_materials')
        THEN '✓ OK: gate_entry_materials exists'
        ELSE '✗ MISSING: gate_entry_materials not found'
    END as status;

-- Check for orphaned foreign keys
SELECT 
    'Orphaned Foreign Keys' as issue_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ OK: No orphaned foreign keys'
        ELSE '⚠ WARNING: ' || COUNT(*) || ' orphaned foreign keys found'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND NOT EXISTS (
        SELECT 1 FROM pg_tables pt
        WHERE pt.schemaname = 'public' 
        AND pt.tablename = ccu.table_name
    );

SELECT '=== END OF HEALTH CHECK ===' as section;
