-- =============================================
-- FOREIGN KEY INTEGRITY VERIFICATION
-- Check all foreign key constraints are valid
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. CHECK ALL FOREIGN KEY CONSTRAINTS
-- =============================================
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = ccu.table_name
        ) THEN '✓ OK'
        ELSE '✗ BROKEN - Referenced table missing'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY 
    CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = ccu.table_name) 
    THEN 1 ELSE 0 END,
    tc.table_name,
    kcu.column_name;

-- =============================================
-- 2. CHECK NEW TABLES' FOREIGN KEYS SPECIFICALLY
-- =============================================
SELECT 
    'Foreign Key Check for New Tables' as check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = ccu.table_name)
        THEN '✓ Valid'
        ELSE '✗ Invalid'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN (
        'material_transfers',
        'material_requests',
        'request_items',
        'stock_alerts',
        'stock_alerts_items',
        'quick_request_templates',
        'gate_entry_materials',
        'order_team_assignments',
        'bom_versions'
    )
ORDER BY tc.table_name, kcu.column_name;

-- =============================================
-- 3. SUMMARY
-- =============================================
SELECT 
    'Foreign Key Summary' as report,
    COUNT(*) as total_foreign_keys,
    COUNT(*) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM pg_tables pt
            WHERE pt.schemaname = 'public' 
            AND pt.tablename = ccu.table_name
        )
    ) as valid_foreign_keys,
    COUNT(*) FILTER (
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_tables pt
            WHERE pt.schemaname = 'public' 
            AND pt.tablename = ccu.table_name
        )
    ) as broken_foreign_keys
FROM information_schema.table_constraints AS tc
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';
