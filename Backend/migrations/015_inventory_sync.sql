-- =============================================
-- INVENTORY SYNCHRONIZATION
-- Keep inventory and inventory_items tables in sync
-- =============================================

-- 1. Ensure inventory_items has product_id and location_id
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- 2. Link existing inventory_items to products based on code
UPDATE inventory_items ii
SET product_id = p.id
FROM products p
WHERE ii.material_code = p.code
AND ii.product_id IS NULL;

-- 3. Create function to sync from inventory_items to inventory
CREATE OR REPLACE FUNCTION sync_items_to_inventory_func()
RETURNS TRIGGER AS $$
DECLARE
    v_location_id UUID;
BEGIN
    -- Only sync if product_id is set
    IF NEW.product_id IS NOT NULL THEN
        -- Link location string to location_id if missing but string exists
        IF NEW.location_id IS NULL AND NEW.location IS NOT NULL THEN
            SELECT id INTO v_location_id FROM locations WHERE name = NEW.location OR code = NEW.location LIMIT 1;
            NEW.location_id := v_location_id;
        END IF;

        -- Update or Insert into inventory
        -- Note: inventory table uses lot_number. inventory_items doesn't.
        -- We'll sync to a 'DEFAULT' lot or the first one found if needed, 
        -- but typically inventory_items represents the aggregate or a specific stock entry.
        
        IF NEW.location_id IS NOT NULL THEN
            UPDATE inventory 
            SET 
                available_qty = NEW.quantity,
                allocated_qty = NEW.allocated_quantity,
                updated_at = NOW()
            WHERE product_id = NEW.product_id 
            AND location_id = NEW.location_id;
            
            IF NOT FOUND THEN
                INSERT INTO inventory (product_id, location_id, available_qty, allocated_qty, lot_number)
                VALUES (NEW.product_id, NEW.location_id, NEW.quantity, NEW.allocated_quantity, 'GEN-SYNC');
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for inventory_items
DROP TRIGGER IF EXISTS trigger_sync_items_to_inventory ON inventory_items;
CREATE TRIGGER trigger_sync_items_to_inventory
AFTER INSERT OR UPDATE OF quantity, allocated_quantity ON inventory_items
FOR EACH ROW EXECUTE FUNCTION sync_items_to_inventory_func();

-- 5. Create function to sync from inventory to inventory_items
CREATE OR REPLACE FUNCTION sync_inventory_to_items_func()
RETURNS TRIGGER AS $$
BEGIN
    -- Update inventory_items if matching product and location
    UPDATE inventory_items
    SET 
        quantity = NEW.available_qty,
        allocated_quantity = NEW.allocated_qty,
        updated_at = NOW()
    WHERE product_id = NEW.product_id 
    AND location_id = NEW.location_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for inventory
DROP TRIGGER IF EXISTS trigger_sync_inventory_to_items ON inventory;
CREATE TRIGGER trigger_sync_inventory_to_items
AFTER INSERT OR UPDATE OF available_qty, allocated_qty ON inventory
FOR EACH ROW EXECUTE FUNCTION sync_inventory_to_items_func();
