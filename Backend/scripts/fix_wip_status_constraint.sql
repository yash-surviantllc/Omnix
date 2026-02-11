-- Add 'On Hold' to the allowed statuses for work_order_operations
ALTER TABLE work_order_operations DROP CONSTRAINT IF EXISTS work_order_operations_status_check;

ALTER TABLE work_order_operations ADD CONSTRAINT work_order_operations_status_check 
    CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Skipped', 'On Hold'));
