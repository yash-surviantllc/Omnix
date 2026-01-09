-- =============================================
-- ADD ARCHIVED STATUS TO PURCHASE ORDERS
-- =============================================

-- Add is_archived column to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add archived_at timestamp
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Add archived_by user reference
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id);

-- Create index for archived orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_archived ON purchase_orders(is_archived);

-- Add comment
COMMENT ON COLUMN purchase_orders.is_archived IS 'Whether this order has been archived';
COMMENT ON COLUMN purchase_orders.archived_at IS 'When the order was archived';
COMMENT ON COLUMN purchase_orders.archived_by IS 'User who archived the order';
