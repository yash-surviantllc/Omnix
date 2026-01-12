-- Terminology Unification: Ensure working_orders is the primary table
-- and has necessary Multi-SKU support (product_id)

-- 1. Add product_id to working_orders if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'working_orders' AND column_name = 'product_id') THEN
        ALTER TABLE working_orders ADD COLUMN product_id UUID REFERENCES products(id);
    END IF;
END $$;

-- 2. Ensure working_order_seq exists
CREATE SEQUENCE IF NOT EXISTS working_order_seq START WITH 1;

-- 3. If work_orders table exists, we might want to migrate data, 
-- but for now let's just ensure working_orders is correct.

-- 4. Add index for product_id on working_orders
CREATE INDEX IF NOT EXISTS idx_working_orders_product_id ON working_orders(product_id);

-- 5. Update any existing working_orders that might be missing product_id 
-- by pulling it from the production_order if it's a single-SKU order
UPDATE working_orders wo
SET product_id = po.product_id
FROM production_orders po
WHERE wo.production_order_id = po.id
AND wo.product_id IS NULL;
