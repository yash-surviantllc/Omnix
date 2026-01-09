-- =============================================
-- ADD ASSIGNED_TEAM COLUMN TO PURCHASE_ORDERS
-- =============================================

-- Add assigned_team column to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS assigned_team VARCHAR(100);

-- Create index for team-based queries
CREATE INDEX IF NOT EXISTS idx_purchase_orders_team ON purchase_orders(assigned_team);

-- Add comment
COMMENT ON COLUMN purchase_orders.assigned_team IS 'Team assigned to this purchase order (e.g., Team A - Cutting Department)';
