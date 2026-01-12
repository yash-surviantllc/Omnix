-- Add shift column and remove assigned_team from working_orders
ALTER TABLE working_orders ADD COLUMN IF NOT EXISTS shift VARCHAR(20);
ALTER TABLE working_orders DROP COLUMN IF EXISTS assigned_team;

-- Update constraints for priority if needed (ensure PascalCase)
ALTER TABLE working_orders DROP CONSTRAINT IF EXISTS working_orders_priority_check;
ALTER TABLE working_orders ADD CONSTRAINT working_orders_priority_check CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent'));

-- Add index for shift
CREATE INDEX IF NOT EXISTS idx_working_orders_shift ON working_orders(shift);
