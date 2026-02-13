-- =============================================
-- 002: INVENTORY & SUPPLY CHAIN
-- Unified Migration for Omnix Manufacturing
-- Merged from 002, 005, 009, 010
-- =============================================

SET search_path TO public;

-- 1. PRODUCTS & LOCATIONS
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(15, 2) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('store','production_line','warehouse','quality','scrap')),
    parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 2. INVENTORY & STOCK MANAGEMENT
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    lot_number VARCHAR(100) NOT NULL DEFAULT 'GENERAL',
    available_qty DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
    allocated_qty DECIMAL(15, 3) NOT NULL DEFAULT 0 CHECK (allocated_qty >= 0),
    free_qty DECIMAL(15, 3) GENERATED ALWAYS AS (available_qty - allocated_qty) STORED,
    last_transaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, location_id, lot_number)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('PURCHASE','CONSUMPTION','TRANSFER','ADJUST','RETURN','SCRAP')),
    quantity DECIMAL(15, 3) NOT NULL,
    from_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    to_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_code VARCHAR(100) UNIQUE NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(20) NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    reorder_level DECIMAL(15, 3) DEFAULT 0,
    min_stock_level DECIMAL(15, 3) DEFAULT 0,
    max_stock_level DECIMAL(15, 3),
    unit_cost DECIMAL(15, 2) DEFAULT 0,
    location TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'sufficient',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_item_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('IN','OUT','ADJUST')),
    quantity_before DECIMAL(15, 3),
    quantity_change DECIMAL(15, 3) NOT NULL,
    quantity_after DECIMAL(15, 3),
    unit VARCHAR(20) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    reference_number VARCHAR(100),
    reason TEXT,
    unit_cost DECIMAL(15, 2) DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BILL OF MATERIALS (BOM) & FUNCTIONS
CREATE TABLE IF NOT EXISTS boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    batch_size DECIMAL(15, 3) DEFAULT 100 CHECK (batch_size > 0),
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (product_id, version)
);

CREATE TABLE IF NOT EXISTS bom_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    waste_percentage DECIMAL(5, 2) DEFAULT 0,
    scrap_percentage DECIMAL(5, 2) DEFAULT 0,
    is_sub_assembly BOOLEAN NOT NULL DEFAULT FALSE,
    sub_assembly_bom_id UUID REFERENCES boms(id) ON DELETE SET NULL,
    unit_cost DECIMAL(15, 2) DEFAULT 0,
    sequence_number INTEGER,
    level INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bom_id, material_id)
);

CREATE OR REPLACE VIEW bom_exploded AS
WITH RECURSIVE bom_hierarchy AS (
    SELECT bm.id, bm.bom_id, bm.material_id, bm.quantity, bm.unit, bm.scrap_percentage, bm.unit_cost, bm.is_sub_assembly, bm.sub_assembly_bom_id, 0 AS level, bm.quantity::NUMERIC AS total_quantity, ARRAY[bm.material_id] AS path
    FROM bom_materials bm WHERE bm.level = 0 OR bm.level IS NULL
    UNION ALL
    SELECT bm.id, bh.bom_id, bm.material_id, bm.quantity, bm.unit, bm.scrap_percentage, bm.unit_cost, bm.is_sub_assembly, bm.sub_assembly_bom_id, bh.level + 1, (bh.total_quantity * bm.quantity)::NUMERIC AS total_quantity, bh.path || bm.material_id
    FROM bom_materials bm JOIN bom_hierarchy bh ON bm.bom_id = bh.sub_assembly_bom_id WHERE bm.material_id <> ALL(bh.path)
) SELECT * FROM bom_hierarchy;

-- 4. CUSTOMERS & SUPPLY CHAIN
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    address_line_1 TEXT,
    address_line_2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    gst_number VARCHAR(15),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gate_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN (
        -- Uppercase variants
        'INBOUND', 'OUTBOUND', 'MATERIAL_TRANSFER', 'SCRAP', 'RETURN', 'SAMPLE',
        -- Lowercase variants used by service layer
        'material', 'courier', 'visitor', 'jobwork_return', 'subcontract_return', 
        'delivery', 'machine_spare', 'inbound', 'outbound', 'material_transfer', 
        'scrap', 'return', 'sample'
    )),
    entry_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vendor VARCHAR(255),
    vehicle_number VARCHAR(50),
    driver_name VARCHAR(100),
    contact_number VARCHAR(20),
    destination_department VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        -- Uppercase variants
        'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
        -- Mixed case variants used by service layer
        'Arrived', 'Under Verification', 'Accepted', 'Rejected',
        -- Lowercase variants
        'pending', 'in_progress', 'completed', 'cancelled',
        'arrived', 'under_verification', 'accepted', 'rejected'
    )),
    reference_document_number VARCHAR(100),
    source_location_id UUID REFERENCES locations(id),
    destination_location_id UUID REFERENCES locations(id),
    remarks TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE gate_entries IS 'Gate entry records for inbound materials, deliveries, visitors, etc.';
COMMENT ON COLUMN gate_entries.vendor IS 'Vendor or supplier name for inbound materials';
COMMENT ON COLUMN gate_entries.destination_department IS 'Internal department receiving the materials (Store, QA, Maintenance, Production, Admin)';
COMMENT ON COLUMN gate_entries.remarks IS 'Additional notes or remarks about the entry';
COMMENT ON COLUMN gate_entries.created_by IS 'User who created this entry';

CREATE TABLE IF NOT EXISTS gate_exits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exit_number VARCHAR(50) UNIQUE NOT NULL,
    exit_type VARCHAR(50) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    vehicle_no VARCHAR(50),
    driver_name VARCHAR(100),
    linked_document VARCHAR(100),
    materials JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'ready',
    remarks TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gate_exits IS 'Gate exit records for outbound materials, dispatches, etc.';
COMMENT ON COLUMN gate_exits.materials IS 'JSONB array of materials being dispatched';
COMMENT ON COLUMN gate_exits.created_by IS 'User who created this exit';

-- Note: gate_entry_materials table moved to 008_missing_tables.sql for consistency with service layer

CREATE TABLE IF NOT EXISTS finished_goods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    allocated_quantity DECIMAL(15,3) DEFAULT 0,
    dispatched_quantity DECIMAL(15,3) DEFAULT 0,
    available_quantity DECIMAL(15,3) GENERATED ALWAYS AS (quantity - allocated_quantity - dispatched_quantity) STORED,
    unit VARCHAR(20) NOT NULL,
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    location_id UUID REFERENCES locations(id),
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ALLOCATED', 'DISPATCHED', 'HOLD', 'QUARANTINE', 'SCRAPPED')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, batch_number, production_date)
);

CREATE TABLE IF NOT EXISTS dispatch_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(50) UNIQUE NOT NULL,
    dispatch_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id UUID REFERENCES customers(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'PICKING', 'DELIVERED', 'CANCELLED')),
    total_quantity DECIMAL(15,3) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatch_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_order_id UUID NOT NULL REFERENCES dispatch_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. TRIGGERS & HELPERS
CREATE OR REPLACE FUNCTION apply_inventory_item_transaction()
RETURNS TRIGGER AS $$
DECLARE current_qty DECIMAL(15, 3);
BEGIN
    SELECT quantity INTO current_qty FROM inventory_items WHERE id = NEW.inventory_item_id FOR UPDATE;
    NEW.quantity_before := current_qty;
    NEW.quantity_after := current_qty + COALESCE(NEW.quantity_change, 0);
    UPDATE inventory_items SET quantity = NEW.quantity_after, updated_at = NOW() WHERE id = NEW.inventory_item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_item_transactions_apply BEFORE INSERT ON inventory_item_transactions FOR EACH ROW EXECUTE FUNCTION apply_inventory_item_transaction();

CREATE OR REPLACE FUNCTION update_inventory_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE inventory SET updated_at = NOW(), last_transaction_at = NOW()
    WHERE product_id = NEW.product_id AND (location_id = NEW.from_location_id OR location_id = NEW.to_location_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_updates AFTER INSERT OR UPDATE ON inventory_transactions FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamps();

-- SEED BASE LOCATIONS
INSERT INTO locations (id, code, name, type) VALUES
    ('00000000-0000-0000-0001-000000000001', 'MAIN-STORE', 'Main Store', 'store'),
    ('00000000-0000-0000-0001-000000000002', 'PROD-LINE-1', 'Production Line 1', 'production_line'),
    ('00000000-0000-0000-0001-000000000003', 'QUALITY', 'Quality Control', 'quality'),
    ('00000000-0000-0000-0001-000000000004', 'SCRAP', 'Scrap Area', 'scrap')
ON CONFLICT (code) DO NOTHING;

-- 6. DOCUMENTATION
COMMENT ON TABLE inventory IS 'Aggregated stock levels per product and location. Use this for general stock availability checks.';
COMMENT ON TABLE inventory_items IS 'Individual item or batch tracking. Use this for specific item history, serial numbers, or batch expiry.';
COMMENT ON COLUMN inventory_transactions.transaction_type IS 'High-level business transaction types: PURCHASE, CONSUMPTION, TRANSFER, ADJUST, RETURN, SCRAP.';
COMMENT ON COLUMN inventory_item_transactions.transaction_type IS 'Low-level physical movement types: IN, OUT, ADJUST.';
