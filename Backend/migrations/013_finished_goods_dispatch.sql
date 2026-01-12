-- Migration 013: Finished Goods & Dispatch Tracking
-- Add finished goods inventory and dispatch tracking for PO fulfillment

-- Finished Goods table
CREATE TABLE IF NOT EXISTS finished_goods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
    production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'In Stock',
    quality_status VARCHAR(50) NOT NULL DEFAULT 'Approved',
    batch_number VARCHAR(100),
    manufactured_date TIMESTAMP,
    expiry_date TIMESTAMP,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dispatch records
CREATE TABLE IF NOT EXISTS dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(100) UNIQUE NOT NULL,
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    dispatch_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_name VARCHAR(255),
    delivery_address TEXT,
    vehicle_number VARCHAR(50),
    driver_name VARCHAR(255),
    driver_contact VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dispatch items (linking FG to dispatches)
CREATE TABLE IF NOT EXISTS dispatch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
    finished_good_id UUID NOT NULL REFERENCES finished_goods(id) ON DELETE RESTRICT,
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add FG and dispatch tracking columns to production_orders
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS quantity_completed DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_in_fg DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_dispatched DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_reworked DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_scrapped DECIMAL(10, 2) DEFAULT 0;

-- Add completed quantity to work_orders
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS quantity_completed DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_reworked DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_scrapped DECIMAL(10, 2) DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_finished_goods_product ON finished_goods(product_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_work_order ON finished_goods(work_order_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_production_order ON finished_goods(production_order_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_status ON finished_goods(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_production_order ON dispatches(production_order_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_product ON dispatches(product_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch ON dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_fg ON dispatch_items(finished_good_id);

-- Function to auto-generate dispatch numbers
CREATE OR REPLACE FUNCTION generate_dispatch_number()
RETURNS TRIGGER AS $$
DECLARE
    year_part VARCHAR(4);
    seq_num INTEGER;
    new_number VARCHAR(100);
BEGIN
    year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(dispatch_number FROM 9) AS INTEGER)), 0) + 1
    INTO seq_num
    FROM dispatches
    WHERE dispatch_number LIKE 'DISP-' || year_part || '-%';
    
    new_number := 'DISP-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
    NEW.dispatch_number := new_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for dispatch number generation
DROP TRIGGER IF EXISTS trigger_generate_dispatch_number ON dispatches;
CREATE TRIGGER trigger_generate_dispatch_number
    BEFORE INSERT ON dispatches
    FOR EACH ROW
    WHEN (NEW.dispatch_number IS NULL OR NEW.dispatch_number = '')
    EXECUTE FUNCTION generate_dispatch_number();

-- Function to update PO quantities when FG is created
CREATE OR REPLACE FUNCTION update_po_on_fg_creation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.production_order_id IS NOT NULL THEN
        UPDATE production_orders
        SET 
            quantity_completed = quantity_completed + NEW.quantity,
            quantity_in_fg = quantity_in_fg + NEW.quantity,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.production_order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for FG creation
DROP TRIGGER IF EXISTS trigger_update_po_on_fg_creation ON finished_goods;
CREATE TRIGGER trigger_update_po_on_fg_creation
    AFTER INSERT ON finished_goods
    FOR EACH ROW
    EXECUTE FUNCTION update_po_on_fg_creation();

-- Function to update PO quantities when dispatch happens
CREATE OR REPLACE FUNCTION update_po_on_dispatch()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE production_orders
    SET 
        quantity_dispatched = quantity_dispatched + NEW.quantity,
        quantity_in_fg = quantity_in_fg - NEW.quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.production_order_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for dispatch
DROP TRIGGER IF EXISTS trigger_update_po_on_dispatch ON dispatches;
CREATE TRIGGER trigger_update_po_on_dispatch
    AFTER INSERT ON dispatches
    FOR EACH ROW
    EXECUTE FUNCTION update_po_on_dispatch();

-- Function to update work order quantities
CREATE OR REPLACE FUNCTION update_wo_quantities()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.work_order_id IS NOT NULL THEN
        UPDATE work_orders
        SET 
            quantity_completed = quantity_completed + NEW.quantity,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.work_order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for WO quantity update
DROP TRIGGER IF EXISTS trigger_update_wo_quantities ON finished_goods;
CREATE TRIGGER trigger_update_wo_quantities
    AFTER INSERT ON finished_goods
    FOR EACH ROW
    EXECUTE FUNCTION update_wo_quantities();

-- Comments
COMMENT ON TABLE finished_goods IS 'Finished goods inventory from completed work orders';
COMMENT ON TABLE dispatches IS 'Dispatch records for finished goods delivery';
COMMENT ON TABLE dispatch_items IS 'Items included in each dispatch';
COMMENT ON COLUMN production_orders.quantity_completed IS 'Total quantity completed from all work orders';
COMMENT ON COLUMN production_orders.quantity_in_fg IS 'Quantity currently in finished goods inventory';
COMMENT ON COLUMN production_orders.quantity_dispatched IS 'Quantity dispatched to customers';
COMMENT ON COLUMN production_orders.quantity_reworked IS 'Quantity sent for rework';
COMMENT ON COLUMN production_orders.quantity_scrapped IS 'Quantity scrapped/rejected';
