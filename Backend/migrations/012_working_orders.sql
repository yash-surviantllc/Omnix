-- =============================================
-- WORK ORDERS TABLE (PO-Based)
-- =============================================

CREATE TABLE IF NOT EXISTS working_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    working_order_number VARCHAR(50) UNIQUE NOT NULL,
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    shift VARCHAR(20) NOT NULL CHECK (shift IN ('Morning', 'Afternoon', 'Night')),
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status VARCHAR(20) DEFAULT 'Planned' CHECK (status IN ('Planned', 'In Progress', 'Completed', 'Cancelled')),
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_working_orders_po_id ON working_orders(production_order_id);
CREATE INDEX IF NOT EXISTS idx_working_orders_product_id ON working_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_working_orders_status ON working_orders(status);
CREATE INDEX IF NOT EXISTS idx_working_orders_shift ON working_orders(shift);
CREATE INDEX IF NOT EXISTS idx_working_orders_number ON working_orders(working_order_number);

-- Add trigger for updated_at
CREATE TRIGGER update_working_orders_updated_at 
BEFORE UPDATE ON working_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Working order materials (calculated from BOM)
CREATE TABLE IF NOT EXISTS working_order_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    working_order_id UUID NOT NULL REFERENCES working_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES products(id),
    required_qty DECIMAL(15,3) NOT NULL,
    allocated_qty DECIMAL(15,3) DEFAULT 0,
    issued_qty DECIMAL(15,3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Allocated', 'Issued', 'Shortage')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_wo_materials_wo_id ON working_order_materials(working_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_materials_material_id ON working_order_materials(material_id);

-- Add trigger for updated_at
CREATE TRIGGER update_working_order_materials_updated_at 
BEFORE UPDATE ON working_order_materials
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Working order number sequence
CREATE SEQUENCE IF NOT EXISTS working_order_seq START WITH 1;

-- Add comments
COMMENT ON TABLE working_orders IS 'PO-based working orders with shift management';
COMMENT ON TABLE working_order_materials IS 'BOM-calculated material requirements for working orders';
