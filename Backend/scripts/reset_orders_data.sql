-- =============================================
-- RESET PURCHASE ORDERS & WORKING ORDERS
-- This script completely clears all PO and WO data
-- and resets numbering sequences to start fresh
-- =============================================
-- 
-- WARNING: This will DELETE ALL data related to:
-- - Purchase Orders
-- - Working Orders
-- - WIP Stage Transfers
-- - Material Requisitions
-- - Order Stage Tracking
-- - Work Order Operations
-- - Work Order Materials
-- 
-- BACKUP YOUR DATA BEFORE RUNNING THIS SCRIPT!
-- =============================================

SET search_path TO public;

-- =============================================
-- STEP 1: DISABLE TRIGGERS (Optional - for faster deletion)
-- =============================================
-- Uncomment if you want faster deletion (but be careful!)
-- ALTER TABLE purchase_orders DISABLE TRIGGER ALL;
-- ALTER TABLE work_orders DISABLE TRIGGER ALL;

-- =============================================
-- STEP 2: DELETE DATA (in correct order to respect FK constraints)
-- =============================================

-- Delete WIP Stage Transfers (references work_orders)
DELETE FROM wip_stage_transfers;
RAISE NOTICE 'Deleted all WIP stage transfers';

-- Delete Material Requisitions (references work_orders)
DELETE FROM material_requisitions;
RAISE NOTICE 'Deleted all material requisitions';

-- Delete Order Stage Tracking (references work_orders or purchase_orders)
DELETE FROM order_stage_tracking;
RAISE NOTICE 'Deleted all order stage tracking';

-- Delete Work Order Operations (references work_orders)
DELETE FROM work_order_operations;
RAISE NOTICE 'Deleted all work order operations';

-- Delete Work Order Materials (references work_orders)
DELETE FROM work_order_materials;
RAISE NOTICE 'Deleted all work order materials';

-- Delete Work Orders (references purchase_orders)
DELETE FROM work_orders;
RAISE NOTICE 'Deleted all work orders';

-- Delete Purchase Order Items (references purchase_orders)
DELETE FROM purchase_order_items;
RAISE NOTICE 'Deleted all purchase order items';

-- Delete Purchase Orders (parent table)
DELETE FROM purchase_orders;
RAISE NOTICE 'Deleted all purchase orders';

-- Delete QC Inspections (if they reference purchase_orders)
DELETE FROM qc_inspections WHERE purchase_order_id IS NOT NULL;
RAISE NOTICE 'Deleted all QC inspections related to purchase orders';

-- Delete Stage Transfers (if they reference purchase_orders)
DELETE FROM stage_transfers WHERE order_id IN (SELECT id FROM purchase_orders);
RAISE NOTICE 'Deleted all stage transfers related to purchase orders';

-- =============================================
-- STEP 3: RESET SEQUENCES
-- =============================================

-- Reset Working Order sequence to 1
ALTER SEQUENCE working_order_seq RESTART WITH 1;
RAISE NOTICE 'Reset working_order_seq to 1';

-- Reset WIP Transfer sequence to 1
ALTER SEQUENCE wip_transfer_seq RESTART WITH 1;
RAISE NOTICE 'Reset wip_transfer_seq to 1';

-- Reset Material Requisition sequence to 1
ALTER SEQUENCE material_requisition_seq RESTART WITH 1;
RAISE NOTICE 'Reset material_requisition_seq to 1';

-- Note: Purchase Order numbering is typically handled in application code
-- If you have a purchase_order_seq, uncomment below:
-- ALTER SEQUENCE purchase_order_seq RESTART WITH 1;
-- RAISE NOTICE 'Reset purchase_order_seq to 1';

-- =============================================
-- STEP 4: RE-ENABLE TRIGGERS (if disabled)
-- =============================================
-- Uncomment if you disabled triggers in Step 1
-- ALTER TABLE purchase_orders ENABLE TRIGGER ALL;
-- ALTER TABLE work_orders ENABLE TRIGGER ALL;

-- =============================================
-- STEP 5: VERIFY CLEANUP
-- =============================================

-- Show counts (should all be 0)
DO $$
DECLARE
    po_count INTEGER;
    wo_count INTEGER;
    wip_transfer_count INTEGER;
    mat_req_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO po_count FROM purchase_orders;
    SELECT COUNT(*) INTO wo_count FROM work_orders;
    SELECT COUNT(*) INTO wip_transfer_count FROM wip_stage_transfers;
    SELECT COUNT(*) INTO mat_req_count FROM material_requisitions;
    
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'CLEANUP VERIFICATION:';
    RAISE NOTICE 'Purchase Orders: %', po_count;
    RAISE NOTICE 'Work Orders: %', wo_count;
    RAISE NOTICE 'WIP Stage Transfers: %', wip_transfer_count;
    RAISE NOTICE 'Material Requisitions: %', mat_req_count;
    RAISE NOTICE '==============================================';
    
    IF po_count = 0 AND wo_count = 0 THEN
        RAISE NOTICE '✅ SUCCESS: All data cleared successfully!';
        RAISE NOTICE 'Next PO number will be: PO-2026-0001';
        RAISE NOTICE 'Next WO number will be: WO-2026-0001';
    ELSE
        RAISE WARNING '⚠️  Some data still remains. Check foreign key constraints.';
    END IF;
END $$;

-- =============================================
-- NOTES:
-- =============================================
-- 1. This script uses CASCADE deletes where defined in schema
-- 2. Sequences are reset to 1 for fresh numbering
-- 3. The year (2026) in order numbers is handled by application code
-- 4. Run this in Supabase SQL Editor
-- 5. Make sure to backup data before running!
-- =============================================
