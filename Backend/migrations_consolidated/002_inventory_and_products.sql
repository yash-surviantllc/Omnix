-- =============================================
-- INVENTORY & PRODUCTS CONSOLIDATED SCHEMA (MODULE 002)
-- =============================================
-- Houses product master data, BOMs, inventory tables, inventory_items
-- ecosystem, and related triggers/indexes. Core helpers live in 001.
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. PRODUCT & LOCATION MASTER DATA
-- =============================================

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

ALTER TABLE IF EXISTS locations
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- =============================================
-- 2. INVENTORY POSITION TABLES
-- =============================================

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
    last_stock_update TIMESTAMPTZ,
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
    unit_cost DECIMAL(15, 2),
    reference_type VARCHAR(50),
    reference_id UUID,
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_alerts_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('LOW_STOCK','CRITICAL','OVERSTOCK')),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
    message TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 3. BILL OF MATERIALS & ENHANCEMENTS
-- =============================================

CREATE TABLE IF NOT EXISTS boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    batch_size DECIMAL(15, 3) DEFAULT 100 CHECK (batch_size > 0),
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    template_name VARCHAR(255),
    parent_bom_id UUID REFERENCES boms(id) ON DELETE SET NULL,
    is_sub_assembly BOOLEAN NOT NULL DEFAULT FALSE,
    hierarchy_level INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
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
    waste_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (waste_percentage >= 0 AND waste_percentage <= 100),
    scrap_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (scrap_percentage >= 0 AND scrap_percentage <= 100),
    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
    is_sub_assembly BOOLEAN NOT NULL DEFAULT FALSE,
    sub_assembly_bom_id UUID REFERENCES boms(id) ON DELETE SET NULL,
    unit_cost DECIMAL(15, 2) DEFAULT 0,
    sequence_number INTEGER,
    level INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE (bom_id, material_id)
);

ALTER TABLE bom_materials DROP CONSTRAINT IF EXISTS check_no_self_reference;
ALTER TABLE bom_materials
    ADD CONSTRAINT check_no_self_reference CHECK (bom_id IS DISTINCT FROM sub_assembly_bom_id);

ALTER TABLE bom_materials DROP CONSTRAINT IF EXISTS check_sub_assembly_consistency;
ALTER TABLE bom_materials
    ADD CONSTRAINT check_sub_assembly_consistency
    CHECK ((is_sub_assembly AND sub_assembly_bom_id IS NOT NULL)
        OR (NOT is_sub_assembly AND sub_assembly_bom_id IS NULL));

CREATE TABLE IF NOT EXISTS bom_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    effective_date DATE NOT NULL,
    snapshot JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    UNIQUE (bom_id, version)
);

CREATE OR REPLACE VIEW bom_exploded AS
WITH RECURSIVE bom_hierarchy AS (
    SELECT
        bm.id,
        bm.bom_id,
        bm.material_id,
        bm.quantity,
        bm.unit,
        bm.scrap_percentage,
        bm.unit_cost,
        bm.sequence_number,
        bm.is_sub_assembly,
        bm.sub_assembly_bom_id,
        0 AS level,
        bm.quantity::NUMERIC AS total_quantity,
        ARRAY[bm.material_id] AS path
    FROM bom_materials bm
    WHERE bm.level = 0 OR bm.level IS NULL

    UNION ALL

    SELECT
        bm.id,
        bh.bom_id,
        bm.material_id,
        bm.quantity,
        bm.unit,
        bm.scrap_percentage,
        bm.unit_cost,
        bm.sequence_number,
        bm.is_sub_assembly,
        bm.sub_assembly_bom_id,
        bh.level + 1,
        (bh.total_quantity * bm.quantity)::NUMERIC AS total_quantity,
        bh.path || bm.material_id
    FROM bom_materials bm
    JOIN bom_hierarchy bh ON bm.bom_id = bh.sub_assembly_bom_id
    WHERE bm.material_id <> ALL(bh.path)
)
SELECT * FROM bom_hierarchy;

CREATE OR REPLACE FUNCTION get_bom_total_cost(p_bom_id UUID)
RETURNS DECIMAL(15, 2) AS $$
DECLARE
    total_cost DECIMAL(15, 2);
BEGIN
    SELECT COALESCE(SUM(
        CASE
            WHEN bm.is_sub_assembly AND bm.sub_assembly_bom_id IS NOT NULL THEN
                get_bom_total_cost(bm.sub_assembly_bom_id) * bm.quantity
            ELSE
                bm.quantity * COALESCE(bm.unit_cost, 0) * (1 + COALESCE(bm.scrap_percentage, 0) / 100)
        END
    ), 0)
    INTO total_cost
    FROM bom_materials bm
    WHERE bm.bom_id = p_bom_id;

    RETURN total_cost;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_bom_circular_reference(
    p_bom_id UUID,
    p_sub_assembly_bom_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    has_circular BOOLEAN;
BEGIN
    WITH RECURSIVE bom_tree AS (
        SELECT sub_assembly_bom_id AS bom_id
        FROM bom_materials
        WHERE bom_id = p_sub_assembly_bom_id

        UNION

        SELECT bm.sub_assembly_bom_id
        FROM bom_materials bm
        JOIN bom_tree bt ON bm.bom_id = bt.bom_id
        WHERE bm.is_sub_assembly = TRUE
    )
    SELECT EXISTS(SELECT 1 FROM bom_tree WHERE bom_id = p_bom_id)
    INTO has_circular;

    RETURN has_circular;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 4. INVENTORY SUPPORT FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION update_inventory_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE inventory
    SET updated_at = NOW(),
        last_transaction_at = NOW()
    WHERE product_id = NEW.product_id
      AND (location_id = NEW.from_location_id OR location_id = NEW.to_location_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION apply_inventory_item_transaction()
RETURNS TRIGGER AS $$
DECLARE
    current_qty DECIMAL(15, 3);
BEGIN
    SELECT quantity INTO current_qty
    FROM inventory_items
    WHERE id = NEW.inventory_item_id
    FOR UPDATE;

    IF current_qty IS NULL THEN
        RAISE EXCEPTION 'Inventory item % not found', NEW.inventory_item_id;
    END IF;

    NEW.quantity_before := current_qty;
    NEW.quantity_after := current_qty + COALESCE(NEW.quantity_change, 0);

    UPDATE inventory_items
    SET quantity = NEW.quantity_after,
        last_stock_update = NOW(),
        updated_at = NOW()
    WHERE id = NEW.inventory_item_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 5. TRIGGERS
-- =============================================

DO $$
DECLARE
    rec RECORD;
    updated_tables TEXT[] := ARRAY[
        'products','locations','inventory','inventory_transactions','inventory_items',
        'inventory_item_transactions','stock_alerts_items','boms','bom_materials','bom_versions'
    ];
BEGIN
    FOR rec IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.column_name = 'updated_at'
          AND c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.table_name = ANY(updated_tables)
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON %1$I;', rec.table_name);
        EXECUTE format('CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION update_timestamps();', rec.table_name);
    END LOOP;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'inventory_transactions_update_inventory'
          AND tgrelid = 'inventory_transactions'::regclass
    ) THEN
        CREATE TRIGGER inventory_transactions_update_inventory
        AFTER INSERT OR UPDATE ON inventory_transactions
        FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'inventory_item_transactions_apply'
          AND tgrelid = 'inventory_item_transactions'::regclass
    ) THEN
        CREATE TRIGGER inventory_item_transactions_apply
        BEFORE INSERT ON inventory_item_transactions
        FOR EACH ROW EXECUTE FUNCTION apply_inventory_item_transaction();
    END IF;
END$$;

-- =============================================
-- 6. INDEXES (USING ensure_index_exists FROM 001)
-- =============================================

SELECT ensure_index_exists('products', 'idx_products_code', 'CREATE UNIQUE INDEX idx_products_code ON products(code);');
SELECT ensure_index_exists('products', 'idx_products_category', 'CREATE INDEX idx_products_category ON products(category);');
SELECT ensure_index_exists('products', 'idx_products_is_active', 'CREATE INDEX idx_products_is_active ON products(is_active);');
SELECT ensure_index_exists('products', 'idx_products_name_search', 'CREATE INDEX idx_products_name_search ON products USING gin (to_tsvector(''english'', name));');

SELECT ensure_index_exists('locations', 'idx_locations_code', 'CREATE UNIQUE INDEX idx_locations_code ON locations(code);');
SELECT ensure_index_exists('locations', 'idx_locations_type', 'CREATE INDEX idx_locations_type ON locations(type);');
SELECT ensure_index_exists('locations', 'idx_locations_parent', 'CREATE INDEX idx_locations_parent ON locations(parent_id) WHERE parent_id IS NOT NULL;');

SELECT ensure_index_exists('inventory', 'idx_inventory_product', 'CREATE INDEX idx_inventory_product ON inventory(product_id);');
SELECT ensure_index_exists('inventory', 'idx_inventory_location', 'CREATE INDEX idx_inventory_location ON inventory(location_id);');
SELECT ensure_index_exists('inventory', 'idx_inventory_product_location_lot', 'CREATE UNIQUE INDEX idx_inventory_product_location_lot ON inventory(product_id, location_id, lot_number);');

SELECT ensure_index_exists('inventory_transactions', 'idx_inv_trans_product', 'CREATE INDEX idx_inv_trans_product ON inventory_transactions(product_id);');
SELECT ensure_index_exists('inventory_transactions', 'idx_inv_trans_type', 'CREATE INDEX idx_inv_trans_type ON inventory_transactions(transaction_type);');
SELECT ensure_index_exists('inventory_transactions', 'idx_inv_trans_from_location', 'CREATE INDEX idx_inv_trans_from_location ON inventory_transactions(from_location_id) WHERE from_location_id IS NOT NULL;');
SELECT ensure_index_exists('inventory_transactions', 'idx_inv_trans_to_location', 'CREATE INDEX idx_inv_trans_to_location ON inventory_transactions(to_location_id) WHERE to_location_id IS NOT NULL;');
SELECT ensure_index_exists('inventory_transactions', 'idx_inv_trans_reference', 'CREATE INDEX idx_inv_trans_reference ON inventory_transactions(reference_type, reference_id) WHERE reference_id IS NOT NULL;');

SELECT ensure_index_exists('inventory_items', 'idx_inventory_items_code', 'CREATE UNIQUE INDEX idx_inventory_items_code ON inventory_items(material_code);');
SELECT ensure_index_exists('inventory_items', 'idx_inventory_items_category', 'CREATE INDEX idx_inventory_items_category ON inventory_items(category);');
SELECT ensure_index_exists('inventory_items', 'idx_inventory_items_status', 'CREATE INDEX idx_inventory_items_status ON inventory_items(status);');

SELECT ensure_index_exists('inventory_item_transactions', 'idx_inventory_item_transactions_item', 'CREATE INDEX idx_inventory_item_transactions_item ON inventory_item_transactions(inventory_item_id);');
SELECT ensure_index_exists('inventory_item_transactions', 'idx_inventory_item_transactions_ref', 'CREATE INDEX idx_inventory_item_transactions_ref ON inventory_item_transactions(reference_type, reference_id);');

SELECT ensure_index_exists('stock_alerts_items', 'idx_stock_alerts_item', 'CREATE INDEX idx_stock_alerts_item ON stock_alerts_items(inventory_item_id);');
SELECT ensure_index_exists('stock_alerts_items', 'idx_stock_alerts_status', 'CREATE INDEX idx_stock_alerts_status ON stock_alerts_items(status);');

SELECT ensure_index_exists('boms', 'idx_boms_product', 'CREATE INDEX idx_boms_product ON boms(product_id);');
SELECT ensure_index_exists('boms', 'idx_boms_hierarchy_level', 'CREATE INDEX idx_boms_hierarchy_level ON boms(hierarchy_level);');
SELECT ensure_index_exists('bom_materials', 'idx_bom_materials_bom', 'CREATE INDEX idx_bom_materials_bom ON bom_materials(bom_id);');
SELECT ensure_index_exists('bom_materials', 'idx_bom_materials_material', 'CREATE INDEX idx_bom_materials_material ON bom_materials(material_id);');
SELECT ensure_index_exists('bom_materials', 'idx_bom_materials_subassembly', 'CREATE INDEX idx_bom_materials_subassembly ON bom_materials(sub_assembly_bom_id);');
SELECT ensure_index_exists('bom_versions', 'idx_bom_versions_bom', 'CREATE INDEX idx_bom_versions_bom ON bom_versions(bom_id);');

-- =============================================
-- 7. INITIAL DATA
-- =============================================

INSERT INTO locations (id, code, name, type, is_active)
VALUES
    ('00000000-0000-0000-0001-000000000001', 'MAIN-STORE', 'Main Store', 'store', TRUE),
    ('00000000-0000-0000-0001-000000000002', 'PROD-LINE-1', 'Production Line 1', 'production_line', TRUE),
    ('00000000-0000-0000-0001-000000000003', 'QUALITY', 'Quality Control', 'quality', TRUE),
    ('00000000-0000-0000-0001-000000000004', 'SCRAP', 'Scrap Area', 'scrap', TRUE)
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id
    FROM users
    WHERE username = 'admin'
    ORDER BY created_at
    LIMIT 1;

    INSERT INTO inventory_items (
        material_code, material_name, category, quantity, unit, location,
        reorder_level, unit_cost, status, created_by
    ) VALUES
        ('FAB-COT-001', 'Cotton Fabric', 'Raw Materials', 500, 'm', 'Warehouse A - Aisle 1', 100, 150.00, 'sufficient', admin_id),
        ('THR-POL-001', 'Polyester Thread', 'Raw Materials', 10000, 'pcs', 'Warehouse A - Aisle 2', 2000, 5.00, 'sufficient', admin_id),
        ('ZIP-MET-001', 'Metal Zipper', 'Raw Materials', 200, 'pcs', 'Warehouse B - Bin 3', 50, 25.00, 'sufficient', admin_id),
        ('BTN-PLA-001', 'Plastic Button', 'Raw Materials', 5000, 'pcs', 'Warehouse B - Bin 5', 1000, 2.50, 'sufficient', admin_id)
    ON CONFLICT (material_code) DO NOTHING;

    INSERT INTO inventory_item_transactions (
        inventory_item_id,
        transaction_type,
        quantity_change,
        unit,
        unit_cost,
        reference_type,
        reason,
        created_by
    )
    SELECT id, 'IN', quantity, unit, unit_cost, 'initial_stock', 'Initial sync', admin_id
    FROM inventory_items
    WHERE created_by = admin_id
    ON CONFLICT DO NOTHING;
END $$;

-- =============================================
-- 8. COMMENTS
-- =============================================

COMMENT ON TABLE products IS 'Product master covering raw materials, WIP, and finished goods';
COMMENT ON TABLE locations IS 'Physical/logical locations where inventory is stored or consumed';
COMMENT ON TABLE inventory IS 'Per-product inventory balance by location and lot';
COMMENT ON TABLE inventory_transactions IS 'Transactional history of product inventory movements';
COMMENT ON TABLE inventory_items IS 'Raw material/item catalogue with aggregate stock balances';
COMMENT ON TABLE inventory_item_transactions IS 'Transaction history for inventory_items quantity adjustments';
COMMENT ON TABLE stock_alerts_items IS 'Alert records for low, critical, or overstock situations';
COMMENT ON TABLE boms IS 'Bill of Materials headers with hierarchy metadata';
COMMENT ON TABLE bom_materials IS 'Component rows per BOM including sub-assembly metadata';
COMMENT ON VIEW bom_exploded IS 'Recursive flattened BOM hierarchy with cumulative quantities';
COMMENT ON TABLE bom_versions IS 'Snapshot history of BOM revisions';
