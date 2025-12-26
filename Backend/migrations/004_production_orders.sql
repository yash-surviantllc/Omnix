-- =============================================
-- PRODUCTION ORDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Planned' CHECK (status IN ('Planned', 'In Progress', 'Completed', 'Cancelled')),
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    due_date DATE NOT NULL,
    start_date DATE,
    completion_date DATE,
    routing_stages JSONB, -- Array of stage IDs
    notes TEXT,
    qr_code TEXT, -- QR code data
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prod_orders_order_number ON production_orders(order_number);
CREATE INDEX idx_prod_orders_product_id ON production_orders(product_id);
CREATE INDEX idx_prod_orders_status ON production_orders(status);
CREATE INDEX idx_prod_orders_priority ON production_orders(priority);
CREATE INDEX idx_prod_orders_due_date ON production_orders(due_date);
CREATE INDEX idx_prod_orders_created_by ON production_orders(created_by);

-- =============================================
-- ORDER MATERIALS TABLE (Material Requirements)
-- =============================================
CREATE TABLE IF NOT EXISTS order_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    required_qty DECIMAL(15,3) NOT NULL,
    allocated_qty DECIMAL(15,3) DEFAULT 0,
    issued_qty DECIMAL(15,3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    availability_status VARCHAR(20) DEFAULT 'Available' CHECK (availability_status IN ('Available', 'Partial', 'Shortage')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_materials_order_id ON order_materials(order_id);
CREATE INDEX idx_order_materials_product_id ON order_materials(product_id);
CREATE INDEX idx_order_materials_status ON order_materials(availability_status);

-- =============================================
-- ORDER TEAM ASSIGNMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS order_team_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    UNIQUE(order_id, user_id)
);

CREATE INDEX idx_order_team_order_id ON order_team_assignments(order_id);
CREATE INDEX idx_order_team_user_id ON order_team_assignments(user_id);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_production_orders_updated_at BEFORE UPDATE ON production_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_materials_updated_at BEFORE UPDATE ON order_materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ORDER NUMBER SEQUENCE
-- =============================================
CREATE SEQUENCE IF NOT EXISTS production_order_seq START WITH 1;

-- =============================================
-- SAMPLE DATA
-- =============================================
-- Sample Production Orders
INSERT INTO production_orders (
    order_number, product_id, quantity, unit, status, priority, due_date, notes
)
SELECT
    'PO-2024-' || LPAD(generate_series::text, 4, '0'),
    p.id,
    CASE 
        WHEN generate_series % 3 = 0 THEN 100
        WHEN generate_series % 3 = 1 THEN 50
        ELSE 200
    END,
    p.unit,
    CASE 
        WHEN generate_series % 4 = 0 THEN 'Planned'
        WHEN generate_series % 4 = 1 THEN 'In Progress'
        WHEN generate_series % 4 = 2 THEN 'Completed'
        ELSE 'Planned'
    END,
    CASE 
        WHEN generate_series % 4 = 0 THEN 'Urgent'
        WHEN generate_series % 4 = 1 THEN 'High'
        WHEN generate_series % 4 = 2 THEN 'Medium'
        ELSE 'Low'
    END,
    CURRENT_DATE + (generate_series || ' days')::interval,
    'Sample production order #' || generate_series
FROM generate_series(1, 5) AS generate_series
CROSS JOIN (
    SELECT id, unit FROM products WHERE category = 'Finished Goods' LIMIT 1
) p
ON CONFLICT (order_number) DO NOTHING;

-- Link some materials to orders (auto-calculate from BOM would happen in the service)
-- This is just sample data
DO $$
DECLARE
    v_order_id UUID;
    v_raw_material_id UUID;
BEGIN
    -- Get first order
    SELECT id INTO v_order_id FROM production_orders LIMIT 1;
    
    -- Get first raw material
    SELECT id INTO v_raw_material_id FROM products WHERE category = 'Raw Material' LIMIT 1;
    
    IF v_order_id IS NOT NULL AND v_raw_material_id IS NOT NULL THEN
        INSERT INTO order_materials (order_id, product_id, required_qty, unit, availability_status)
        VALUES 
            (v_order_id, v_raw_material_id, 50, 'kg', 'Available');
    END IF;
END $$;

----------------------------------------------------------------------------------------------------------------------
-- Add missing columns to production_orders table
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS shift_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS production_stage VARCHAR(100),
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS progress_percentage DECIMAL(5,2) DEFAULT 0;

-- Create index for customer search
CREATE INDEX IF NOT EXISTS idx_prod_orders_customer ON production_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_prod_orders_stage ON production_orders(production_stage);