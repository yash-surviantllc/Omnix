-- =============================================
-- MIGRATION 003 VERIFICATION QUERIES
-- =============================================
-- Run these AFTER running 003_orders_and_wip.sql
-- to verify everything is correct

SET search_path TO public;

-- =============================================
-- 1. VERIFY TABLES EXIST
-- =============================================
SELECT 'Checking tables...' as status;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_orders') 
        THEN '✅ work_orders table exists'
        ELSE '❌ work_orders table MISSING'
    END as check_1,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_order_operations') 
        THEN '✅ work_order_operations table exists'
        ELSE '❌ work_order_operations table MISSING'
    END as check_2,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wip_stages') 
        THEN '✅ wip_stages table exists'
        ELSE '❌ wip_stages table MISSING'
    END as check_3,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'config_stages') 
        THEN '✅ config_stages table exists'
        ELSE '❌ config_stages table MISSING'
    END as check_4;

-- =============================================
-- 2. VERIFY config_id COLUMN EXISTS
-- =============================================
SELECT 'Checking config_id column...' as status;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'work_orders' 
            AND column_name = 'config_id'
        ) 
        THEN '✅ config_id column exists in work_orders'
        ELSE '❌ config_id column MISSING in work_orders'
    END as check_config_id;

-- =============================================
-- 3. VERIFY VIEW EXISTS WITH config_id
-- =============================================
SELECT 'Checking vw_work_order_status view...' as status;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_name = 'vw_work_order_status'
        ) 
        THEN '✅ vw_work_order_status view exists'
        ELSE '❌ vw_work_order_status view MISSING'
    END as check_view;

-- Check if view includes config_id
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.view_column_usage 
            WHERE view_name = 'vw_work_order_status' 
            AND column_name = 'config_id'
        ) 
        THEN '✅ vw_work_order_status includes config_id'
        ELSE '❌ vw_work_order_status MISSING config_id'
    END as check_view_config_id;

-- =============================================
-- 4. VERIFY SYSTEM_CONFIG_RULES STAGE EXISTS
-- =============================================
SELECT 'Checking SYSTEM_CONFIG_RULES stage...' as status;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM wip_stages 
            WHERE code = 'SYSTEM_CONFIG_RULES'
        ) 
        THEN '✅ SYSTEM_CONFIG_RULES stage exists'
        ELSE '❌ SYSTEM_CONFIG_RULES stage MISSING'
    END as check_system_stage;

-- =============================================
-- 5. VERIFY WORK ORDERS HAVE config_id
-- =============================================
SELECT 'Checking work orders config_id values...' as status;

SELECT 
    COUNT(*) as total_work_orders,
    COUNT(CASE WHEN config_id IS NOT NULL THEN 1 END) as with_config_id,
    COUNT(CASE WHEN config_id IS NULL THEN 1 END) as without_config_id,
    CASE 
        WHEN COUNT(CASE WHEN config_id IS NULL THEN 1 END) = 0 
        THEN '✅ All work orders have config_id'
        ELSE '⚠️ Some work orders missing config_id'
    END as status
FROM work_orders;

-- =============================================
-- 6. VERIFY WORK ORDER OPERATIONS BACKFILLED
-- =============================================
SELECT 'Checking work order operations...' as status;

SELECT 
    COUNT(DISTINCT wo.id) as total_work_orders,
    COUNT(DISTINCT woo.work_order_id) as work_orders_with_operations,
    COUNT(DISTINCT wo.id) - COUNT(DISTINCT woo.work_order_id) as work_orders_without_operations,
    CASE 
        WHEN COUNT(DISTINCT wo.id) = COUNT(DISTINCT woo.work_order_id) 
        THEN '✅ All work orders have operations'
        ELSE '⚠️ Some work orders missing operations'
    END as status
FROM work_orders wo
LEFT JOIN work_order_operations woo ON woo.work_order_id = wo.id;

-- =============================================
-- 7. SHOW SAMPLE WORK ORDER WITH OPERATIONS
-- =============================================
SELECT 'Sample work order with operations...' as status;

SELECT 
    wo.work_order_number,
    wo.config_id,
    woo.operation_name,
    woo.sequence_number,
    woo.status
FROM work_orders wo
LEFT JOIN work_order_operations woo ON woo.work_order_id = wo.id
ORDER BY wo.created_at DESC, woo.sequence_number
LIMIT 10;

-- =============================================
-- 8. VERIFY DEFAULT CONFIG HAS STAGES
-- =============================================
SELECT 'Checking default config stages...' as status;

SELECT 
    cs.config_id,
    ws.name as stage_name,
    cs.sequence_number,
    ws.is_active
FROM config_stages cs
JOIN wip_stages ws ON ws.id = cs.stage_id
WHERE cs.config_id = 'default'
ORDER BY cs.sequence_number;

-- =============================================
-- 9. CHECK FOR DUPLICATE STAGES
-- =============================================
SELECT 'Checking for duplicate stages...' as status;

SELECT 
    code,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 1 THEN '⚠️ DUPLICATE'
        ELSE '✅ OK'
    END as status
FROM wip_stages
GROUP BY code
HAVING COUNT(*) > 1;

-- =============================================
-- 10. FINAL SUMMARY
-- =============================================
SELECT 'FINAL SUMMARY' as status;

SELECT 
    '✅ Migration 003 completed successfully!' as result,
    (SELECT COUNT(*) FROM work_orders) as total_work_orders,
    (SELECT COUNT(*) FROM work_order_operations) as total_operations,
    (SELECT COUNT(*) FROM wip_stages) as total_stages,
    (SELECT COUNT(DISTINCT config_id) FROM config_stages) as total_configs;

-- =============================================
-- END OF VERIFICATION
-- =============================================
