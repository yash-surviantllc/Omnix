-- =============================================
-- RENAME PRODUCTION ORDERS TO PURCHASE ORDERS
-- AND CONSOLIDATE WORK ORDERS
-- =============================================

-- Rename tables
ALTER TABLE IF EXISTS production_orders RENAME TO purchase_orders;
ALTER TABLE order_materials RENAME TO purchase_order_materials;
ALTER TABLE order_team_assignments RENAME TO purchase_order_team_assignments;

-- Update foreign key constraints
ALTER TABLE purchase_order_materials 
    DROP CONSTRAINT IF EXISTS order_materials_order_id_fkey,
    ADD CONSTRAINT purchase_order_materials_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;

ALTER TABLE purchase_order_team_assignments
    DROP CONSTRAINT IF EXISTS order_team_assignments_order_id_fkey,
    ADD CONSTRAINT purchase_order_team_assignments_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;

-- Update indexes
ALTER INDEX IF EXISTS idx_prod_orders_order_number RENAME TO idx_purchase_orders_order_number;
ALTER INDEX IF EXISTS idx_prod_orders_product_id RENAME TO idx_purchase_orders_product_id;
ALTER INDEX IF EXISTS idx_prod_orders_status RENAME TO idx_purchase_orders_status;
ALTER INDEX IF EXISTS idx_prod_orders_priority RENAME TO idx_purchase_orders_priority;
ALTER INDEX IF EXISTS idx_prod_orders_due_date RENAME TO idx_purchase_orders_due_date;
ALTER INDEX IF EXISTS idx_prod_orders_created_by RENAME TO idx_purchase_orders_created_by;

ALTER INDEX IF EXISTS idx_order_materials_order_id RENAME TO idx_purchase_order_materials_order_id;
ALTER INDEX IF EXISTS idx_order_materials_product_id RENAME TO idx_purchase_order_materials_product_id;
ALTER INDEX IF EXISTS idx_order_materials_status RENAME TO idx_purchase_order_materials_status;

-- =============================================
-- CONSOLIDATE WORK_ORDERS AND WORKING_ORDERS
-- =============================================

-- Add missing columns to work_orders if they don't exist
DO $$
BEGIN
    -- Add operation-specific columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'work_orders' AND column_name = 'operation') THEN
        ALTER TABLE work_orders 
        ADD COLUMN operation VARCHAR(100),
        ADD COLUMN workstation VARCHAR(100),
        ADD COLUMN assigned_team VARCHAR(100),
        ADD COLUMN target_qty INT,
        ADD COLUMN completed_qty INT DEFAULT 0;
    END IF;
END $$;

-- Migrate data from working_orders to work_orders
-- Only migrate records that don't have duplicate work_order_number
WITH migrated AS (
    INSERT INTO work_orders (
        work_order_number,
        production_order_id,
        operation,
        workstation,
        assigned_team,
        target_qty,
        completed_qty,
        unit,
        status,
        priority,
        planned_start,
        planned_end,
        actual_start,
        actual_end,
        notes,
        created_by,
        updated_by,
        created_at,
        updated_at
    )
    SELECT 
        wo.work_order_number,
        wo.production_order_id,
        wo.operation,
        wo.workstation,
        wo.assigned_team,
        wo.target_qty,
        wo.completed_qty,
        wo.unit,
        wo.status,
        wo.priority,
        wo.scheduled_start,
        wo.scheduled_end,
        wo.actual_start,
        wo.actual_end,
        wo.notes,
        wo.created_by,
        wo.updated_by,
        wo.created_at,
        wo.updated_at
    FROM working_orders wo
    LEFT JOIN work_orders existing ON wo.work_order_number = existing.work_order_number
    WHERE existing.id IS NULL
    ON CONFLICT (work_order_number) 
    DO UPDATE SET
        operation = EXCLUDED.operation,
        workstation = EXCLUDED.workstation,
        assigned_team = EXCLUDED.assigned_team,
        target_qty = EXCLUDED.target_qty,
        completed_qty = EXCLUDED.completed_qty,
        unit = EXCLUDED.unit,
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        planned_start = EXCLUDED.planned_start,
        planned_end = EXCLUDED.planned_end,
        actual_start = EXCLUDED.actual_start,
        actual_end = EXCLUDED.actual_end,
        notes = COALESCE(work_orders.notes, EXCLUDED.notes),
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
    RETURNING id, work_order_number
)
-- Update any foreign key references
UPDATE work_order_materials wom
SET work_order_id = m.id
FROM migrated m
JOIN working_orders wo ON wo.work_order_number = m.work_order_number
WHERE wom.work_order_id = wo.id;

-- Drop the working_orders table
DROP TABLE IF EXISTS working_orders CASCADE;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_work_orders_operation ON work_orders(operation) WHERE operation IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_workstation ON work_orders(workstation) WHERE workstation IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_team ON work_orders(assigned_team) WHERE assigned_team IS NOT NULL;

-- Update the updated_at trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'update_work_orders_updated_at'
    ) THEN
        CREATE TRIGGER update_work_orders_updated_at
        BEFORE UPDATE ON work_orders
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN work_orders.operation IS 'Specific operation being performed (e.g., Cutting, Sewing)';
COMMENT ON COLUMN work_orders.workstation IS 'Workstation where the work is performed';
COMMENT ON COLUMN work_orders.assigned_team IS 'Team assigned to this work order';
COMMENT ON COLUMN work_orders.target_qty IS 'Target quantity to produce';
COMMENT ON COLUMN work_orders.completed_qty IS 'Quantity completed so far';

-- Update any row-level security policies if applicable
-- (Add the necessary ALTER POLICY or DROP/CREATE POLICY statements here)

-- Update any triggers if they reference the old table names
-- (Add the necessary DROP TRIGGER and CREATE TRIGGER statements here)

-- Update any materialized views if they reference the old table names
-- (Add the necessary REFRESH MATERIALIZED VIEW or DROP/CREATE MATERIALIZED VIEW statements here)

-- Update any stored procedures or functions that reference the old table names
-- (Add the necessary CREATE OR REPLACE FUNCTION statements here)
