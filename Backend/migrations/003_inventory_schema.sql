-- =============================================
-- STEP 1: UPDATE INVENTORY TABLE SCHEMA
-- =============================================

-- Add missing columns to existing inventory table
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_transaction_at TIMESTAMPTZ;

-- Add free_qty as computed column
ALTER TABLE inventory DROP COLUMN IF EXISTS free_qty;
ALTER TABLE inventory 
ADD COLUMN free_qty DECIMAL(15,3) GENERATED ALWAYS AS (available_qty - allocated_qty) STORED;

-- Update existing rows
UPDATE inventory SET allocated_qty = 0 WHERE allocated_qty IS NULL;

-- =============================================
-- STEP 2: RECREATE INVENTORY_TRANSACTIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  transaction_type VARCHAR(50) NOT NULL, 
  -- 'TRANSFER', 'GATE_IN', 'GATE_OUT', 'PRODUCTION', 'ADJUSTMENT', 'ALLOCATION', 'RELEASE'
  quantity DECIMAL(15,3) NOT NULL,
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  reference_id UUID, 
  reference_type VARCHAR(50), 
  -- 'material_transfer', 'gate_entry', 'gate_exit', 'production_order'
  notes TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inv_trans_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inv_trans_date ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_trans_reference ON inventory_transactions(reference_id, reference_type);

-- =============================================
-- STEP 3: ADD TIMESTAMP TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_transaction_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_update_timestamp ON inventory;

CREATE TRIGGER inventory_update_timestamp
BEFORE UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_inventory_timestamp();

-- =============================================
-- STEP 4: ADD SAMPLE TRANSACTION DATA
-- =============================================

DO $$
DECLARE
    store_id UUID;
    line1_id UUID;
    cotton_id UUID;
    thread_id UUID;
    zipper_id UUID;
    steel_id UUID;
    admin_id UUID;
BEGIN
    -- Get location IDs
    SELECT id INTO store_id FROM locations WHERE code = 'STORE-01';
    SELECT id INTO line1_id FROM locations WHERE code = 'LINE-01';
    
    -- Get product IDs
    SELECT id INTO cotton_id FROM products WHERE code = 'MAT-001';
    SELECT id INTO thread_id FROM products WHERE code = 'MAT-002';
    SELECT id INTO zipper_id FROM products WHERE code = 'MAT-003';
    SELECT id INTO steel_id FROM products WHERE code = 'MAT-005';
    
    -- Get admin user (assuming first user is admin)
    SELECT id INTO admin_id FROM users LIMIT 1;
    
    -- Insert sample transactions (Gate Entry - Initial stock receipt)
    INSERT INTO inventory_transactions (
        product_id, 
        transaction_type, 
        quantity, 
        to_location_id, 
        reference_type,
        notes,
        performed_by
    ) VALUES 
        (cotton_id, 'GATE_IN', 500, store_id, 'gate_entry', 'Initial stock - Cotton Fabric', admin_id),
        (thread_id, 'GATE_IN', 10000, store_id, 'gate_entry', 'Initial stock - Thread', admin_id),
        (zipper_id, 'GATE_IN', 200, store_id, 'gate_entry', 'Initial stock - Zippers', admin_id),
        (steel_id, 'GATE_IN', 1000, store_id, 'gate_entry', 'Initial stock - Steel Sheets', admin_id);
    
    -- Insert sample transfer transactions
    IF line1_id IS NOT NULL THEN
        INSERT INTO inventory_transactions (
            product_id, 
            transaction_type, 
            quantity, 
            from_location_id,
            to_location_id, 
            reference_type,
            notes,
            performed_by
        ) VALUES 
            (cotton_id, 'TRANSFER', 50, store_id, line1_id, 'material_transfer', 'Transfer to production line', admin_id),
            (thread_id, 'TRANSFER', 1000, store_id, line1_id, 'material_transfer', 'Transfer to production line', admin_id);
    END IF;
    
    -- Update inventory to reflect transfers
    IF line1_id IS NOT NULL THEN
        -- Deduct from store
        UPDATE inventory 
        SET 
            available_qty = available_qty - 50,
            allocated_qty = 0
        WHERE product_id = cotton_id AND location_id = store_id;
        
        UPDATE inventory 
        SET 
            available_qty = available_qty - 1000,
            allocated_qty = 0
        WHERE product_id = thread_id AND location_id = store_id;
        
        -- Add to production line
        INSERT INTO inventory (product_id, location_id, available_qty, allocated_qty, lot_number)
        VALUES 
            (cotton_id, line1_id, 50, 0, 'LOT-2024-001'),
            (thread_id, line1_id, 1000, 0, 'LOT-2024-002')
        ON CONFLICT (product_id, location_id, lot_number) 
        DO UPDATE SET 
            available_qty = inventory.available_qty + EXCLUDED.available_qty;
    END IF;
    
END $$;

-- =============================================
-- STEP 5: ADD MORE REALISTIC TRANSACTION HISTORY
-- =============================================

DO $$
DECLARE
    store_id UUID;
    cotton_id UUID;
    admin_id UUID;
BEGIN
    SELECT id INTO store_id FROM locations WHERE code = 'STORE-01';
    SELECT id INTO cotton_id FROM products WHERE code = 'MAT-001';
    SELECT id INTO admin_id FROM users LIMIT 1;
    
    -- Simulate various transaction types
    INSERT INTO inventory_transactions (
        product_id, 
        transaction_type, 
        quantity, 
        from_location_id,
        to_location_id,
        reference_type,
        notes,
        performed_by,
        created_at
    ) VALUES 
        -- Adjustments
        (cotton_id, 'ADJUSTMENT', 10, NULL, store_id, 'stock_adjustment', 'Stock count adjustment', admin_id, NOW() - INTERVAL '5 days'),
        (cotton_id, 'ADJUSTMENT', -5, store_id, NULL, 'stock_adjustment', 'Damaged goods written off', admin_id, NOW() - INTERVAL '3 days'),
        
        -- Allocations (for production orders)
        (cotton_id, 'ALLOCATION', 20, NULL, NULL, 'production_order', 'Allocated for PO-2024-001', admin_id, NOW() - INTERVAL '2 days'),
        (cotton_id, 'RELEASE', 20, NULL, NULL, 'production_order', 'Released after production completion', admin_id, NOW() - INTERVAL '1 day');
    
    -- Update allocated qty for demo
    UPDATE inventory 
    SET allocated_qty = 30
    WHERE product_id = cotton_id AND location_id = store_id;
    
END $$;

-- =============================================
-- STEP 6: VERIFY DATA
-- =============================================

-- Check inventory with free_qty calculation
SELECT 
    i.id,
    p.code as product_code,
    p.name as product_name,
    l.name as location,
    i.available_qty,
    i.allocated_qty,
    i.free_qty,
    i.lot_number
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN locations l ON i.location_id = l.id
ORDER BY p.code, l.name;

-- Check transaction history
SELECT 
    it.created_at,
    it.transaction_type,
    p.code as product_code,
    p.name as product_name,
    it.quantity,
    l_from.name as from_location,
    l_to.name as to_location,
    it.reference_type,
    it.notes
FROM inventory_transactions it
JOIN products p ON it.product_id = p.id
LEFT JOIN locations l_from ON it.from_location_id = l_from.id
LEFT JOIN locations l_to ON it.to_location_id = l_to.id
ORDER BY it.created_at DESC
LIMIT 20;

-- Check stock alerts vs current inventory
SELECT 
    p.code,
    p.name,
    l.name as location,
    i.available_qty,
    i.allocated_qty,
    i.free_qty,
    sa.min_qty,
    sa.max_qty,
    CASE 
        WHEN i.free_qty < sa.min_qty THEN 'LOW STOCK'
        WHEN i.free_qty > sa.max_qty THEN 'OVERSTOCK'
        ELSE 'OK'
    END as status
FROM stock_alerts sa
JOIN products p ON sa.product_id = p.id
LEFT JOIN locations l ON sa.location_id = l.id
LEFT JOIN inventory i ON sa.product_id = i.product_id AND (sa.location_id IS NULL OR sa.location_id = i.location_id)
WHERE sa.is_active = true
ORDER BY p.code;