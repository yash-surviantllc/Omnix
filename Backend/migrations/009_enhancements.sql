-- =============================================
-- ENHANCEMENTS MIGRATION
-- Add ordered stock tracking, BOM ID to work orders, and other improvements
-- =============================================

-- =============================================
-- 1. ADD ORDERED QUANTITY TRACKING TO INVENTORY
-- =============================================
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS ordered_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0 CHECK (ordered_quantity >= 0);

-- Add comment for clarity
COMMENT ON COLUMN inventory_items.ordered_quantity IS 'Quantity ordered from suppliers but not yet received';

-- =============================================
-- 2. ADD BOM_ID TO WORKING_ORDERS
-- =============================================
ALTER TABLE working_orders
ADD COLUMN IF NOT EXISTS bom_id UUID REFERENCES boms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_working_orders_bom_id ON working_orders(bom_id);

COMMENT ON COLUMN working_orders.bom_id IS 'Reference to BOM for automatic material calculation';

-- =============================================
-- 3. ADD CANCELLED TO PRIORITY OPTIONS
-- =============================================
-- Drop existing constraint and recreate with Cancelled option
ALTER TABLE production_orders DROP CONSTRAINT IF EXISTS production_orders_priority_check;
ALTER TABLE production_orders ADD CONSTRAINT production_orders_priority_check 
    CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent', 'Cancelled'));

-- =============================================
-- 4. ADD PROGRESS PERCENTAGE TO PRODUCTION ORDERS (if not exists)
-- =============================================
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS progress_percentage DECIMAL(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- =============================================
-- 5. CREATE FUNCTION TO CALCULATE AVAILABLE STOCK
-- (Existing Stock - Allocated Stock)
-- =============================================
CREATE OR REPLACE FUNCTION get_available_stock(p_product_id UUID, p_location_id UUID DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
    v_available NUMERIC;
BEGIN
    IF p_location_id IS NOT NULL THEN
        SELECT COALESCE(SUM(quantity - allocated_quantity), 0)
        INTO v_available
        FROM inventory_items
        WHERE product_id = p_product_id 
        AND location_id = p_location_id;
    ELSE
        SELECT COALESCE(SUM(quantity - allocated_quantity), 0)
        INTO v_available
        FROM inventory_items
        WHERE product_id = p_product_id;
    END IF;
    
    RETURN v_available;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. CREATE FUNCTION TO AUTO-ALLOCATE STOCK FOR WORK ORDER
-- =============================================
CREATE OR REPLACE FUNCTION allocate_stock_for_work_order(p_work_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_bom_id UUID;
    v_production_qty NUMERIC;
    v_material RECORD;
    v_required_qty NUMERIC;
    v_available_qty NUMERIC;
    v_allocated NUMERIC;
BEGIN
    -- Get BOM ID and target quantity from work order
    SELECT bom_id, target_qty INTO v_bom_id, v_production_qty
    FROM working_orders
    WHERE id = p_work_order_id;
    
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
                p_work_order_id, 'working_order', 
                'Stock allocated for work order'
            );
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 7. FIX WIP UTILIZATION FORMULA
-- Utilization = (Target Avg Time ÷ Actual Avg Time) × 100
-- =============================================
CREATE OR REPLACE FUNCTION update_wip_stage_metrics()
RETURNS void AS $$
BEGIN
    -- Update metrics based on current working orders
    UPDATE wip_stage_metrics sm
    SET 
        orders_count = COALESCE(wo_stats.order_count, 0),
        units_count = COALESCE(wo_stats.total_units, 0),
        avg_time_minutes = COALESCE(wo_stats.avg_duration, 0),
        -- FIXED FORMULA: Utilization = (Target / Actual) * 100
        utilization_percentage = CASE 
            WHEN COALESCE(wo_stats.avg_duration, 0) > 0 THEN 
                LEAST(200, (sm.target_time_minutes / wo_stats.avg_duration * 100))
            ELSE 0
        END,
        -- Health status based on utilization
        -- 100% = ideal, >100% = good (faster), <100% = bad (slower)
        -- 80-90% acceptable, <80% warning, >110% warning
        health_status = CASE
            WHEN COALESCE(wo_stats.avg_duration, 0) = 0 THEN 'healthy'
            WHEN (sm.target_time_minutes / wo_stats.avg_duration * 100) >= 90 
                 AND (sm.target_time_minutes / wo_stats.avg_duration * 100) <= 110 THEN 'healthy'
            WHEN (sm.target_time_minutes / wo_stats.avg_duration * 100) >= 80 
                 AND (sm.target_time_minutes / wo_stats.avg_duration * 100) < 90 THEN 'warning'
            WHEN (sm.target_time_minutes / wo_stats.avg_duration * 100) > 110 
                 AND (sm.target_time_minutes / wo_stats.avg_duration * 100) <= 120 THEN 'warning'
            ELSE 'delayed'
        END,
        updated_at = CURRENT_TIMESTAMP
    FROM (
        SELECT 
            operation,
            COUNT(DISTINCT production_order_id) as order_count,
            SUM(target_qty) as total_units,
            AVG(EXTRACT(EPOCH FROM (COALESCE(actual_end, CURRENT_TIMESTAMP) - COALESCE(actual_start, scheduled_start))) / 60) as avg_duration
        FROM working_orders
        WHERE status IN ('In Progress', 'Pending')
        GROUP BY operation
    ) wo_stats
    WHERE sm.stage_name = wo_stats.operation;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 8. ADD COMPLETED AND PENDING QUANTITY TRACKING
-- =============================================
-- These are calculated fields, no schema changes needed
-- Will be computed in the application layer

-- =============================================
-- 9. CREATE CLEANUP FUNCTION FOR BOM AND INVENTORY
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_bom_and_inventory()
RETURNS void AS $$
BEGIN
    -- Delete all BOM materials
    DELETE FROM bom_materials;
    
    -- Delete all BOMs
    DELETE FROM boms;
    
    -- Reset inventory allocated quantities
    UPDATE inventory_items SET allocated_quantity = 0;
    
    -- Delete inventory transactions related to allocations
    DELETE FROM inventory_transactions WHERE transaction_type IN ('ALLOCATION', 'RELEASE');
    
    RAISE NOTICE 'BOM and Inventory data cleaned up successfully';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 10. UPDATE PRODUCTION ORDER PROGRESS CALCULATION
-- =============================================
CREATE OR REPLACE FUNCTION update_production_order_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_total_target NUMERIC;
    v_total_completed NUMERIC;
    v_progress NUMERIC;
BEGIN
    -- Calculate progress based on working orders
    SELECT 
        COALESCE(SUM(target_qty), 0),
        COALESCE(SUM(completed_qty), 0)
    INTO v_total_target, v_total_completed
    FROM working_orders
    WHERE production_order_id = NEW.production_order_id;
    
    -- Calculate percentage
    IF v_total_target > 0 THEN
        v_progress := (v_total_completed / v_total_target) * 100;
    ELSE
        v_progress := 0;
    END IF;
    
    -- Update production order
    UPDATE production_orders
    SET progress_percentage = v_progress
    WHERE id = NEW.production_order_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating progress
DROP TRIGGER IF EXISTS trigger_update_production_order_progress ON working_orders;
CREATE TRIGGER trigger_update_production_order_progress
AFTER INSERT OR UPDATE OF completed_qty ON working_orders
FOR EACH ROW
EXECUTE FUNCTION update_production_order_progress();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_inventory_items_ordered_qty ON inventory_items(ordered_quantity) WHERE ordered_quantity > 0;
CREATE INDEX IF NOT EXISTS idx_production_orders_progress ON production_orders(progress_percentage);

-- =============================================
-- SAMPLE DATA UPDATES
-- =============================================
-- Update existing data to have some ordered quantities
UPDATE inventory_items 
SET ordered_quantity = FLOOR(RANDOM() * 100 + 50)
WHERE RANDOM() < 0.3; -- 30% of items have pending orders
