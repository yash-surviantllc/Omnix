-- =============================================
-- TABLE COLUMN VERIFICATION
-- Check if existing tables have all required columns
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. CHECK INVENTORY TABLE COLUMNS
-- =============================================
SELECT 
    'inventory table' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'inventory'
ORDER BY ordinal_position;

-- Check for expected columns
SELECT 
    'inventory - Missing Columns Check' as check_type,
    expected_column,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'inventory' 
            AND column_name = expected_column
        ) THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM (VALUES 
    ('id'),
    ('product_id'),
    ('location_id'),
    ('lot_number'),
    ('available_qty'),
    ('allocated_qty'),
    ('free_qty'),
    ('last_transaction_at'),
    ('created_at'),
    ('updated_at')
) AS expected(expected_column);

-- =============================================
-- 2. CHECK INVENTORY_ITEMS TABLE COLUMNS
-- =============================================
SELECT 
    'inventory_items table' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'inventory_items'
ORDER BY ordinal_position;

-- Check for expected columns
SELECT 
    'inventory_items - Missing Columns Check' as check_type,
    expected_column,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'inventory_items' 
            AND column_name = expected_column
        ) THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM (VALUES 
    ('id'),
    ('material_code'),
    ('material_name'),
    ('description'),
    ('category'),
    ('unit'),
    ('quantity'),
    ('reorder_level'),
    ('min_stock_level'),
    ('max_stock_level'),
    ('unit_cost'),
    ('location'),
    ('status'),
    ('metadata'),
    ('created_at'),
    ('updated_at'),
    ('created_by'),
    ('updated_by')
) AS expected(expected_column);

-- =============================================
-- 3. CHECK PURCHASE_ORDERS TABLE COLUMNS
-- =============================================
SELECT 
    'purchase_orders table' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'purchase_orders'
ORDER BY ordinal_position;

-- =============================================
-- 4. CHECK WORK_ORDERS TABLE COLUMNS
-- =============================================
SELECT 
    'work_orders table' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'work_orders'
ORDER BY ordinal_position;

-- =============================================
-- 5. CHECK GATE_ENTRIES TABLE COLUMNS
-- =============================================
SELECT 
    'gate_entries table' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'gate_entries'
ORDER BY ordinal_position;

-- =============================================
-- 6. CHECK IF gate_entry_items STILL EXISTS
-- =============================================
SELECT 
    'gate_entry_items conflict check' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_items')
        THEN '⚠ WARNING: gate_entry_items still exists alongside gate_entry_materials'
        ELSE '✓ OK: Only gate_entry_materials exists'
    END as status;

-- =============================================
-- 7. SUMMARY OF ALL TABLES
-- =============================================
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN (
        'inventory',
        'inventory_items',
        'inventory_transactions',
        'inventory_item_transactions',
        'products',
        'locations',
        'purchase_orders',
        'work_orders',
        'boms',
        'bom_materials',
        'bom_versions',
        'material_transfers',
        'material_requests',
        'request_items',
        'material_requisitions',
        'material_requisition_items',
        'gate_entries',
        'gate_entry_materials',
        'gate_exits',
        'wip_stages',
        'wip_stage_transfers',
        'qc_inspections',
        'qc_defects',
        'stock_alerts',
        'stock_alerts_items',
        'notifications'
    )
GROUP BY table_name
ORDER BY table_name;
