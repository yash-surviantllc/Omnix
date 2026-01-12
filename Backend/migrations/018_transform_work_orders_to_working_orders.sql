-- =============================================
-- TRANSFORM WORK ORDERS TO WORKING ORDERS
-- Update existing work_orders table to match operation-based working_orders schema
-- =============================================

-- =============================================
-- 1. BACKUP EXISTING DATA
-- =============================================
CREATE TABLE IF NOT EXISTS work_orders_backup AS
SELECT * FROM work_orders;

-- =============================================
-- 2. DROP EXISTING CONSTRAINTS AND INDEXES
-- =============================================
DROP TRIGGER IF EXISTS update_work_orders_updated_at ON work_orders;
DROP INDEX IF EXISTS idx_work_orders_po_id;
DROP INDEX IF EXISTS idx_work_orders_product_id;
DROP INDEX IF EXISTS idx_work_orders_status;
DROP INDEX IF EXISTS idx_work_orders_shift;
DROP INDEX IF EXISTS idx_work_orders_number;

-- =============================================
-- 3. RENAME TABLE
-- =============================================
ALTER TABLE work_orders RENAME TO working_orders;

-- =============================================
-- 4. UPDATE TABLE SCHEMA
-- =============================================
-- Drop columns that don't exist in the new schema
ALTER TABLE working_orders DROP COLUMN IF EXISTS product_id;
ALTER TABLE working_orders DROP COLUMN IF EXISTS shift;

-- Add new columns for operation-based schema
ALTER TABLE working_orders ADD COLUMN IF NOT EXISTS operation VARCHAR(100);
ALTER TABLE working_orders ADD COLUMN IF NOT EXISTS workstation VARCHAR(100);
ALTER TABLE working_orders ADD COLUMN IF NOT EXISTS assigned_team VARCHAR(100);
ALTER TABLE working_orders ADD COLUMN IF NOT EXISTS rejected_qty DECIMAL(15,3) DEFAULT 0;
ALTER TABLE working_orders ADD COLUMN IF NOT EXISTS actual_start TIMESTAMP;
ALTER TABLE working_orders ADD COLUMN IF NOT EXISTS actual_end TIMESTAMP;

-- Update existing columns to match new schema
ALTER TABLE working_orders RENAME COLUMN quantity TO target_qty;
ALTER TABLE working_orders ALTER COLUMN priority SET DEFAULT 'Normal';
ALTER TABLE working_orders ALTER COLUMN status SET DEFAULT 'Pending';

-- Update status values to match new schema
UPDATE working_orders SET status =
  CASE
    WHEN status = 'Planned' THEN 'Pending'
    WHEN status = 'In Progress' THEN 'In Progress'
    WHEN status = 'Completed' THEN 'Completed'
    WHEN status = 'Cancelled' THEN 'Cancelled'
    ELSE 'Pending'
  END;

-- Update priority values to match new schema
UPDATE working_orders SET priority =
  CASE
    WHEN priority = 'Low' THEN 'Low'
    WHEN priority = 'Medium' THEN 'Normal'
    WHEN priority = 'High' THEN 'High'
    WHEN priority = 'Urgent' THEN 'Urgent'
    ELSE 'Normal'
  END;

-- Set default values for new columns
UPDATE working_orders SET
  operation = 'Production',
  workstation = 'Default Workstation',
  assigned_team = 'Default Team',
  rejected_qty = 0
WHERE operation IS NULL;

-- Make required columns NOT NULL
ALTER TABLE working_orders ALTER COLUMN operation SET NOT NULL;
ALTER TABLE working_orders ALTER COLUMN target_qty SET NOT NULL;
ALTER TABLE working_orders ALTER COLUMN unit SET NOT NULL;

-- =============================================
-- 5. UPDATE CONSTRAINTS
-- =============================================
-- Add new check constraints
ALTER TABLE working_orders DROP CONSTRAINT IF EXISTS work_orders_target_qty_check;
ALTER TABLE working_orders ADD CONSTRAINT working_orders_target_qty_check CHECK (target_qty > 0);

ALTER TABLE working_orders DROP CONSTRAINT IF EXISTS work_orders_rejected_qty_check;
ALTER TABLE working_orders ADD CONSTRAINT working_orders_rejected_qty_check CHECK (rejected_qty >= 0);

ALTER TABLE working_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE working_orders DROP CONSTRAINT IF EXISTS working_orders_status_check;
ALTER TABLE working_orders ADD CONSTRAINT working_orders_status_check CHECK (status IN ('Pending', 'In Progress', 'Completed', 'On Hold', 'Cancelled'));

ALTER TABLE working_orders DROP CONSTRAINT IF EXISTS work_orders_priority_check;
ALTER TABLE working_orders DROP CONSTRAINT IF EXISTS working_orders_priority_check;
ALTER TABLE working_orders ADD CONSTRAINT working_orders_priority_check CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent'));

-- =============================================
-- 6. RECREATE INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_working_orders_prod_order ON working_orders(production_order_id);
CREATE INDEX IF NOT EXISTS idx_working_orders_operation ON working_orders(operation);
CREATE INDEX IF NOT EXISTS idx_working_orders_status ON working_orders(status);
CREATE INDEX IF NOT EXISTS idx_working_orders_workstation ON working_orders(workstation);
CREATE INDEX IF NOT EXISTS idx_working_orders_number ON working_orders(work_order_number);

-- =============================================
-- 7. RECREATE TRIGGERS
-- =============================================
CREATE TRIGGER update_working_orders_updated_at
BEFORE UPDATE ON working_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 8. UPDATE FUNCTIONS THAT REFERENCE THE TABLE
-- =============================================
-- Update any functions that reference work_orders to use working_orders

-- =============================================
-- 9. DROP WORK ORDER MATERIALS TABLE (if it exists)
-- =============================================
-- The new schema doesn't use work_order_materials, it uses direct BOM calculations
DROP TABLE IF EXISTS work_order_materials;

-- =============================================
-- 10. VERIFICATION
-- =============================================
DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
BEGIN
    -- Check if table was renamed
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'working_orders'
    ) INTO table_exists;

    IF NOT table_exists THEN
        RAISE EXCEPTION 'Table working_orders does not exist';
    END IF;

    -- Check column count
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'working_orders';

    RAISE NOTICE 'Migration completed successfully. working_orders table has % columns.', column_count;
    RAISE NOTICE 'Backup table work_orders_backup created for rollback if needed.';
END $$;
