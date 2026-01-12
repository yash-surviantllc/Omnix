-- =============================================
-- CLEANUP MOCK DATA FROM BOM AND INVENTORY
-- =============================================

-- Step 1: Delete working orders (depends on production_orders)
DELETE FROM working_orders;

-- Step 2: Delete order materials (depends on production_orders)
DELETE FROM order_materials;

-- Step 3: Delete production orders (depends on boms via bom_id foreign key)
DELETE FROM production_orders;

-- Step 4: Delete BOM materials (depends on boms)
DELETE FROM bom_materials;

-- Step 5: Delete BOMs
DELETE FROM boms;

-- Step 6: Delete inventory transactions
DELETE FROM inventory_item_transactions;

-- Step 7: Delete stock alerts
DELETE FROM stock_alerts_items;

-- Step 8: Delete all inventory items (raw materials)
DELETE FROM inventory_items WHERE is_active = TRUE;

-- Step 9: Also clean up any soft-deleted inventory items
DELETE FROM inventory_items WHERE is_active = FALSE;

-- Note: We're keeping the products table as it contains SKUs/finished goods
-- Only cleaning raw materials (inventory_items) and their BOMs

-- Verify cleanup
SELECT 'Working Orders remaining: ' || COUNT(*) FROM working_orders;
SELECT 'Production Orders remaining: ' || COUNT(*) FROM production_orders;
SELECT 'BOMs remaining: ' || COUNT(*) FROM boms;
SELECT 'BOM Materials remaining: ' || COUNT(*) FROM bom_materials;
SELECT 'Inventory Items remaining: ' || COUNT(*) FROM inventory_items;
SELECT 'Inventory Transactions remaining: ' || COUNT(*) FROM inventory_item_transactions;
