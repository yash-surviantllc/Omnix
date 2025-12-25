-- =============================================
-- ENHANCED INVENTORY ITEMS MANAGEMENT
-- Separate from products table for raw materials
-- =============================================

-- =============================================
-- STEP 1: CREATE INVENTORY_ITEMS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS inventory_items (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Material Identification (UNIQUE)
    material_code VARCHAR(50) UNIQUE NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    
    -- Categorization
    category VARCHAR(100),
    
    -- Quantity & Units
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    allocated_quantity DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
    free_quantity DECIMAL(15, 3) GENERATED ALWAYS AS (quantity - allocated_quantity) STORED,
    unit VARCHAR(20) NOT NULL, -- 'm', 'kg', 'pcs', 'L', etc.
    
    -- Location
    location VARCHAR(255),
    
    -- Reorder Management
    reorder_level DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'sufficient' 
        CHECK (status IN ('sufficient', 'low', 'critical', 'out_of_stock')),
    
    -- Costing
    unit_cost DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    total_value DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    
    -- Additional Info
    description TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Soft Delete
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_material_code ON inventory_items(material_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_material_name ON inventory_items(material_name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON inventory_items(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at ON inventory_items(created_at DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_inventory_items_search ON inventory_items 
    USING gin(to_tsvector('english', material_name || ' ' || COALESCE(description, '')));

-- =============================================
-- STEP 2: CREATE INVENTORY_ITEM_TRANSACTIONS
-- =============================================

CREATE TABLE IF NOT EXISTS inventory_item_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Item Reference
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    
    -- Transaction Details
    transaction_type VARCHAR(20) NOT NULL 
        CHECK (transaction_type IN ('IN', 'OUT', 'ADJUST', 'TRANSFER', 'RETURN', 'SCRAP')),
    
    -- Quantity Changes
    quantity_before DECIMAL(15, 3) NOT NULL,
    quantity_change DECIMAL(15, 3) NOT NULL,
    quantity_after DECIMAL(15, 3) NOT NULL,
    
    -- Unit & Cost
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(15, 2),
    total_cost DECIMAL(15, 2) GENERATED ALWAYS AS (ABS(quantity_change) * COALESCE(unit_cost, 0)) STORED,
    
    -- References
    reference_type VARCHAR(50),
    reference_id UUID,
    reference_number VARCHAR(100),
    
    -- Additional Info
    reason TEXT,
    notes TEXT,
    
    -- Metadata
    transaction_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_item_transactions_item ON inventory_item_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_item_transactions_type ON inventory_item_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_item_transactions_date ON inventory_item_transactions(transaction_date DESC);

-- =============================================
-- STEP 3: CREATE STOCK_ALERTS_ITEMS
-- =============================================

CREATE TABLE IF NOT EXISTS stock_alerts_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Item Reference
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    
    -- Alert Details
    alert_type VARCHAR(20) NOT NULL 
        CHECK (alert_type IN ('LOW_STOCK', 'CRITICAL_STOCK', 'OUT_OF_STOCK', 'OVERSTOCK')),
    alert_level VARCHAR(20) NOT NULL 
        CHECK (alert_level IN ('INFO', 'WARNING', 'CRITICAL')),
    
    -- Quantities
    current_quantity DECIMAL(15, 3) NOT NULL,
    threshold_quantity DECIMAL(15, 3),
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE' 
        CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),
    
    -- Message
    message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_items_item ON stock_alerts_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_alerts_items_status ON stock_alerts_items(status);
CREATE INDEX IF NOT EXISTS idx_alerts_items_type ON stock_alerts_items(alert_type);

-- =============================================
-- STEP 4: TRIGGERS
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_items_update_timestamp ON inventory_items;

CREATE TRIGGER inventory_items_update_timestamp
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_items_timestamp();

-- Auto-create stock alerts
CREATE OR REPLACE FUNCTION check_inventory_item_stock_levels()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if quantity dropped below reorder level
    IF NEW.quantity <= NEW.reorder_level AND (OLD.quantity IS NULL OR OLD.quantity > NEW.reorder_level) THEN
        INSERT INTO stock_alerts_items (
            inventory_item_id,
            alert_type,
            alert_level,
            current_quantity,
            threshold_quantity,
            message
        ) VALUES (
            NEW.id,
            CASE 
                WHEN NEW.quantity = 0 THEN 'OUT_OF_STOCK'
                WHEN NEW.quantity <= NEW.reorder_level * 0.5 THEN 'CRITICAL_STOCK'
                ELSE 'LOW_STOCK'
            END,
            CASE 
                WHEN NEW.quantity = 0 THEN 'CRITICAL'
                WHEN NEW.quantity <= NEW.reorder_level * 0.5 THEN 'CRITICAL'
                ELSE 'WARNING'
            END,
            NEW.quantity,
            NEW.reorder_level,
            'Stock level for ' || NEW.material_name || ' has dropped below reorder level'
        );
        
        -- Update status
        NEW.status = CASE 
            WHEN NEW.quantity = 0 THEN 'out_of_stock'
            WHEN NEW.quantity <= NEW.reorder_level * 0.5 THEN 'critical'
            ELSE 'low'
        END;
    ELSIF NEW.quantity > NEW.reorder_level THEN
        -- Update status to sufficient
        NEW.status = 'sufficient';
        
        -- Resolve any active alerts
        UPDATE stock_alerts_items 
        SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP
        WHERE inventory_item_id = NEW.id AND status = 'ACTIVE';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_inventory_item_stock_levels ON inventory_items;

CREATE TRIGGER trigger_check_inventory_item_stock_levels
    BEFORE UPDATE OF quantity ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION check_inventory_item_stock_levels();

-- =============================================
-- STEP 5: INSERT SAMPLE DATA
-- =============================================

DO $$
DECLARE
    admin_id UUID;
BEGIN
    -- Get admin user
    SELECT id INTO admin_id FROM users LIMIT 1;
    
    -- Insert sample inventory items
    INSERT INTO inventory_items (
        material_code,
        material_name,
        category,
        quantity,
        unit,
        location,
        reorder_level,
        unit_cost,
        status,
        created_by
    ) VALUES 
        ('FAB-COT-001', 'Cotton Fabric', 'Raw Materials', 500.000, 'm', 'Warehouse A - Aisle 1', 100.000, 150.00, 'sufficient', admin_id),
        ('THR-POL-001', 'Polyester Thread', 'Raw Materials', 10000.000, 'pcs', 'Warehouse A - Aisle 2', 2000.000, 5.00, 'sufficient', admin_id),
        ('ZIP-MET-001', 'Metal Zipper', 'Raw Materials', 200.000, 'pcs', 'Warehouse B - Bin 3', 50.000, 25.00, 'sufficient', admin_id),
        ('BTN-PLA-001', 'Plastic Buttons', 'Raw Materials', 5000.000, 'pcs', 'Warehouse B - Bin 5', 1000.000, 2.50, 'sufficient', admin_id),
        ('FAB-SIL-001', 'Silk Fabric', 'Raw Materials', 50.000, 'm', 'Warehouse A - Aisle 1', 20.000, 300.00, 'low', admin_id),
        ('LEA-GEN-001', 'Genuine Leather', 'Raw Materials', 15.000, 'm', 'Warehouse C - Section 1', 30.000, 500.00, 'critical', admin_id)
    ON CONFLICT (material_code) DO NOTHING;
    
    -- Insert initial transactions
    INSERT INTO inventory_item_transactions (
        inventory_item_id,
        transaction_type,
        quantity_before,
        quantity_change,
        quantity_after,
        unit,
        unit_cost,
        reference_type,
        reason,
        created_by
    )
    SELECT 
        id,
        'IN',
        0,
        quantity,
        quantity,
        unit,
        unit_cost,
        'initial_stock',
        'Initial stock entry',
        admin_id
    FROM inventory_items
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute';
    
END $$;

-- =============================================
-- STEP 6: VERIFY DATA
-- =============================================

SELECT 
    material_code,
    material_name,
    quantity,
    unit,
    location,
    reorder_level,
    status,
    unit_cost,
    total_value
FROM inventory_items
WHERE is_active = TRUE
ORDER BY material_code;
