-- =============================================
-- Standardize Working Order Naming
-- Updates database objects to use consistent 'working_order' naming
-- =============================================

-- =============================================
-- 1. RENAME COLUMNS
-- =============================================
ALTER TABLE working_orders RENAME COLUMN work_order_number TO working_order_number;

-- =============================================
-- 2. UPDATE INDEXES
-- =============================================
DROP INDEX IF EXISTS idx_working_orders_number;
CREATE INDEX idx_working_orders_number ON working_orders(working_order_number);

-- =============================================
-- 3. UPDATE FUNCTIONS
-- =============================================

-- Update allocate_stock_for_work_order function
CREATE OR REPLACE FUNCTION allocate_stock_for_working_order(p_working_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_bom_id UUID;
    v_production_qty NUMERIC;
    v_material RECORD;
    v_required_qty NUMERIC;
    v_available_qty NUMERIC;
    v_allocated NUMERIC;
BEGIN
    -- Get BOM ID and target quantity from working order
    SELECT bom_id, target_qty INTO v_bom_id, v_production_qty
    FROM working_orders
    WHERE id = p_working_order_id;
    
    -- If no BOM ID, return false
    IF v_bom_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Loop through BOM materials and allocate stock
    FOR v_material IN 
        SELECT bm.material_id, bm.quantity as qty_per_unit, bm.unit
        FROM bom_materials bm
        WHERE bm.bom_id = v_bom_id
    LOOP
        -- Calculate required quantity
        v_required_qty := v_material.qty_per_unit * v_production_qty;
        
        -- Check available stock
        v_available_qty := get_available_stock(v_material.material_id);
        
        -- Allocate what's available (up to required amount)
        v_allocated := LEAST(v_required_qty, v_available_qty);
        
        IF v_allocated > 0 THEN
            -- Update inventory allocation (first available item)
            UPDATE inventory_items
            SET allocated_quantity = allocated_quantity + v_allocated
            WHERE id = (
                SELECT id FROM inventory_items
                WHERE product_id = v_material.material_id
                AND (quantity - allocated_quantity) > 0
                ORDER BY created_at
                LIMIT 1
            );
            
            -- Log transaction
            INSERT INTO inventory_transactions (
                product_id, transaction_type, quantity, 
                reference_id, reference_type, notes
            ) VALUES (
                v_material.material_id, 'ALLOCATION', v_allocated,
                p_working_order_id, 'working_order', 
                'Stock allocated for working order'
            );
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS allocate_stock_for_work_order(UUID);

-- =============================================
-- 4. UPDATE SAMPLE DATA IN MIGRATIONS
-- =============================================
-- Update the sample data in the 005_wip_tracking.sql file to use working_order_number
-- This is for reference only as it won't affect existing data

-- =============================================
-- 5. UPDATE TRIGGERS AND OTHER DEPENDENCIES
-- =============================================
-- The triggers and other functions already use 'working_orders' table name,
-- so no changes are needed there

-- =============================================
-- 6. UPDATE SEQUENCE REFERENCES
-- =============================================
-- The sequence is already named 'working_order_seq' and is correct

-- =============================================
-- 7. UPDATE ANY VIEWS OR MATERIALIZED VIEWS
-- =============================================
-- Add any view updates here if they reference work_order_number

-- =============================================
-- 8. UPDATE SAMPLE DATA GENERATION IN MIGRATIONS
-- =============================================
-- Update the sample data generation to use working_order_number
-- This is for reference only as it won't affect existing data

-- =============================================
-- 9. VERIFY CHANGES
-- =============================================
DO $$
BEGIN
    -- Verify column was renamed
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'working_orders' 
        AND column_name = 'working_order_number'
    ) THEN
        RAISE EXCEPTION 'Column working_order_number was not created successfully';
    END IF;
    
    -- Verify function was created
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'allocate_stock_for_working_order'
    ) THEN
        RAISE EXCEPTION 'Function allocate_stock_for_working_order was not created successfully';
    END IF;
    
    RAISE NOTICE 'Database schema updated successfully to use working_order naming';
END $$;
