-- =============================================
-- ADD ASSIGNED_TEAM COLUMN TO PRODUCTION_ORDERS
-- =============================================

-- Add assigned_team column to production_orders table
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS assigned_team VARCHAR(100);

-- Create index for team-based queries
CREATE INDEX IF NOT EXISTS idx_prod_orders_team ON production_orders(assigned_team);

-- Add comment
COMMENT ON COLUMN production_orders.assigned_team IS 'Team assigned to this production order (e.g., Team A - Cutting Department)';
