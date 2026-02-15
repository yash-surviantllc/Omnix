-- =============================================================
-- SCRIPT: CLEAR ALL OPERATIONAL & MASTER DATA (Omnix Manufacturing)
-- Goal: Remove all data for a complete fresh start, 
--       EXCEPT Shifts and WIP Stage definitions.
-- =============================================================

BEGIN;

-- 1. Disable triggers to speed up and avoid side effects
SET session_replication_role = 'replica';

-- 2. CLEAR ALL TABLES (Using CASCADE to handle foreign key dependencies)
-- We include Master Data like Products, BOMs, and Locations here.
TRUNCATE TABLE 
    -- Master Data (Entities)
    products,
    locations,
    customers,
    boms,
    bom_materials,
    bom_versions,
    workstations,
    
    -- Orders & QC (Transactions)
    purchase_orders,
    purchase_order_items,
    work_orders,
    work_order_operations,
    work_order_materials,
    order_materials,
    qc_inspections,
    
    -- WIP Tracking & Config
    order_stage_tracking,
    wip_stage_metrics,
    wip_stage_transfers,
    stage_performance_history,
    product_stages,
    
    -- Inventory Transactions
    inventory,
    inventory_transactions,
    inventory_items,
    inventory_item_transactions,
    finished_goods,
    stock_alerts,
    stock_alerts_items,
    
    -- Gate & Logistics
    gate_entries,
    gate_exits,
    gate_entry_materials,
    dispatch_orders,
    dispatch_order_items,
    
    -- Requisitions & Transfers
    material_requisitions,
    material_requisition_items,
    material_transfers,
    material_requests,
    request_items,
    quick_request_templates,
    
    -- System & Auth Logs
    audit_logs,
    refresh_tokens,
    password_reset_tokens,
    order_team_assignments
CASCADE;

-- 3. RESET DOCUMENT SEQUENCES
UPDATE document_sequences SET next_sequence = 1;

-- 4. RESET INDEPENDENT SEQUENCES
ALTER SEQUENCE IF EXISTS material_requisition_seq RESTART WITH 1;

-- 5. RE-INITIALIZE WIP STAGE METRICS
-- This ensures the dashboard doesn't show empty/stale metrics for stages
INSERT INTO wip_stage_metrics (stage_name, stage_sequence, target_time_minutes)
SELECT name, sequence_number, COALESCE(target_avg_time_minutes, 30)
FROM wip_stages
ON CONFLICT (stage_name) DO UPDATE SET
    orders_count = 0,
    units_count = 0,
    avg_time_minutes = 0,
    utilization_percentage = 0,
    health_status = 'healthy';

-- 6. Restore triggers
SET session_replication_role = 'origin';

-- 7. Verification message
SELECT 'SUCCESS: All operational and master data has been cleared (except Shifts & WIP Config).' as message;

COMMIT;
