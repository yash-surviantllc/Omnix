-- =============================================
-- ADD ARCHIVED STATUS TO PRODUCTION ORDERS
-- =============================================

-- Add is_archived column to production_orders table
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add archived_at timestamp
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Add archived_by user reference
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id);

-- Create index for archived orders
CREATE INDEX IF NOT EXISTS idx_prod_orders_archived ON production_orders(is_archived);

-- Add comment
COMMENT ON COLUMN production_orders.is_archived IS 'Whether this order has been archived';
COMMENT ON COLUMN production_orders.archived_at IS 'When the order was archived';
COMMENT ON COLUMN production_orders.archived_by IS 'User who archived the order';
