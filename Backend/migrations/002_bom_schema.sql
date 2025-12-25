-- =============================================
-- PRODUCTS TABLE (Simplified)
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,  -- Product Code (e.g., JK-001)
    name VARCHAR(255) NOT NULL,        -- Product Name
    description TEXT,
    category VARCHAR(100),             -- Raw Material, Finished Goods, etc.
    unit VARCHAR(20) NOT NULL,         -- kg, meter, pcs, liter
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));

-- =============================================
-- BOMs TABLE (Simplified - One per Product)
-- =============================================
CREATE TABLE IF NOT EXISTS boms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    UNIQUE(product_id)  -- Only one active BOM per product
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_boms_product_id ON boms(product_id);
CREATE INDEX IF NOT EXISTS idx_boms_is_active ON boms(is_active);

-- =============================================
-- BOM_MATERIALS TABLE (Simplified)
-- =============================================
CREATE TABLE IF NOT EXISTS bom_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES products(id),  -- Link to products table
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(15,2) DEFAULT 0,  -- Cost per unit
    sequence_number INTEGER,            -- For ordering in UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bom_materials_bom_id ON bom_materials(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_materials_material_id ON bom_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_bom_materials_sequence ON bom_materials(bom_id, sequence_number);

-- =============================================
-- TRIGGERS for updated_at
-- =============================================
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_boms_updated_at ON boms;
CREATE TRIGGER update_boms_updated_at BEFORE UPDATE ON boms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bom_materials_updated_at ON bom_materials;
CREATE TRIGGER update_bom_materials_updated_at BEFORE UPDATE ON bom_materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SAMPLE DATA for Testing
-- =============================================

-- Raw Materials
INSERT INTO products (code, name, description, category, unit) VALUES
    ('MAT-001', 'Cotton Fabric', 'Premium cotton fabric', 'Raw Material', 'meter'),
    ('MAT-002', 'Polyester Thread', 'Strong polyester thread', 'Raw Material', 'meter'),
    ('MAT-003', 'Zipper', 'Metal zipper 20cm', 'Raw Material', 'pcs'),
    ('MAT-004', 'Button', 'Plastic button 15mm', 'Raw Material', 'pcs'),
    ('MAT-005', 'Steel Sheet', 'Cold rolled steel 1mm', 'Raw Material', 'kg'),
    ('MAT-006', 'Paint - White', 'Industrial white paint', 'Raw Material', 'liter'),
    ('MAT-007', 'Screw M5', 'M5 x 20mm screws', 'Raw Material', 'pcs')
ON CONFLICT (code) DO NOTHING;

-- Finished Goods
INSERT INTO products (code, name, description, category, unit) VALUES
    ('FG-001', 'T-Shirt Basic', 'Cotton t-shirt', 'Finished Goods', 'pcs'),
    ('FG-002', 'Jacket Winter', 'Waterproof winter jacket', 'Finished Goods', 'pcs'),
    ('FG-003', 'Office Chair', 'Ergonomic office chair', 'Finished Goods', 'pcs'),
    ('FG-004', 'Desk Table', 'Adjustable height desk', 'Finished Goods', 'pcs')
ON CONFLICT (code) DO NOTHING;

-- Sample BOM for T-Shirt
DO $$
DECLARE
    tshirt_id UUID;
    bom_id UUID;
    cotton_id UUID;
    thread_id UUID;
    existing_bom_count INTEGER;
BEGIN
    -- Get product IDs
    SELECT id INTO tshirt_id FROM products WHERE code = 'FG-001';
    SELECT id INTO cotton_id FROM products WHERE code = 'MAT-001';
    SELECT id INTO thread_id FROM products WHERE code = 'MAT-002';
    
    -- Check if BOM already exists
    SELECT COUNT(*) INTO existing_bom_count FROM boms WHERE product_id = tshirt_id;
    
    -- Only create if doesn't exist
    IF existing_bom_count = 0 THEN
        -- Create BOM
        INSERT INTO boms (product_id, notes)
        VALUES (tshirt_id, 'Standard t-shirt BOM')
        RETURNING id INTO bom_id;
        
        -- Add materials
        INSERT INTO bom_materials (bom_id, material_id, quantity, unit, unit_cost, sequence_number)
        VALUES 
            (bom_id, cotton_id, 1.5, 'meter', 150.00, 1),
            (bom_id, thread_id, 50, 'meter', 2.00, 2);
    END IF;
END $$;

-- Sample BOM for Jacket
DO $$
DECLARE
    jacket_id UUID;
    bom_id UUID;
    cotton_id UUID;
    thread_id UUID;
    zipper_id UUID;
    button_id UUID;
    existing_bom_count INTEGER;
BEGIN
    SELECT id INTO jacket_id FROM products WHERE code = 'FG-002';
    SELECT id INTO cotton_id FROM products WHERE code = 'MAT-001';
    SELECT id INTO thread_id FROM products WHERE code = 'MAT-002';
    SELECT id INTO zipper_id FROM products WHERE code = 'MAT-003';
    SELECT id INTO button_id FROM products WHERE code = 'MAT-004';
    
    -- Check if BOM already exists
    SELECT COUNT(*) INTO existing_bom_count FROM boms WHERE product_id = jacket_id;
    
    -- Only create if doesn't exist
    IF existing_bom_count = 0 THEN
        INSERT INTO boms (product_id, notes)
        VALUES (jacket_id, 'Winter jacket BOM')
        RETURNING id INTO bom_id;
        
        INSERT INTO bom_materials (bom_id, material_id, quantity, unit, unit_cost, sequence_number)
        VALUES 
            (bom_id, cotton_id, 2.5, 'meter', 150.00, 1),
            (bom_id, thread_id, 100, 'meter', 2.00, 2),
            (bom_id, zipper_id, 1, 'pcs', 25.00, 3),
            (bom_id, button_id, 4, 'pcs', 5.00, 4);
    END IF;
END $$;


-- =============================================
-- ADD MISSING COLUMNS TO BOMS TABLE
-- =============================================
ALTER TABLE boms 
ADD COLUMN IF NOT EXISTS batch_size DECIMAL(15,3) DEFAULT 100 CHECK (batch_size > 0),
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS template_name VARCHAR(255);

-- =============================================
-- ADD MISSING COLUMNS TO BOM_MATERIALS TABLE
-- =============================================
ALTER TABLE bom_materials
ADD COLUMN IF NOT EXISTS scrap_percentage DECIMAL(5,2) DEFAULT 0 CHECK (scrap_percentage >= 0 AND scrap_percentage <= 100);

-- =============================================
-- CREATE BOM VERSIONS TABLE (for version history)
-- =============================================
CREATE TABLE IF NOT EXISTS bom_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    effective_date DATE NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    snapshot JSONB NOT NULL,  -- Full BOM snapshot
    UNIQUE(bom_id, version)
);

CREATE INDEX IF NOT EXISTS idx_bom_versions_bom_id ON bom_versions(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_versions_version ON bom_versions(version);

-- =============================================
-- UPDATE EXISTING BOMS
-- =============================================
-- Set version 1 for all existing BOMs
UPDATE boms SET version = 1 WHERE version IS NULL;

-- Set default batch size for existing BOMs
UPDATE boms SET batch_size = 100 WHERE batch_size IS NULL;

-- Set effective date for existing BOMs
UPDATE boms SET effective_date = CURRENT_DATE WHERE effective_date IS NULL;

-- =============================================
-- CREATE INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_boms_version ON boms(version);
CREATE INDEX IF NOT EXISTS idx_boms_effective_date ON boms(effective_date);
CREATE INDEX IF NOT EXISTS idx_boms_is_template ON boms(is_template);