-- =============================================
-- GATE ENTRIES AND FINISHED GOODS DISPATCH
-- Combines gate entry management and finished goods tracking
-- =============================================

SET search_path TO public;

-- =============================================
-- CUSTOMERS TABLE
-- =============================================

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
    pan_number VARCHAR(10),
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms VARCHAR(100),
    customer_type VARCHAR(50) DEFAULT 'Regular' CHECK (customer_type IN ('Regular', 'Premium', 'Wholesale', 'Retail')),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Align any legacy customer table columns
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'code'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'customer_code'
    ) THEN
        EXECUTE 'ALTER TABLE customers RENAME COLUMN code TO customer_code';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'customer_name'
    ) THEN
        EXECUTE 'ALTER TABLE customers RENAME COLUMN name TO customer_name';
    END IF;
END $$;

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS mobile VARCHAR(20),
    ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
    ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state VARCHAR(100),
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS country VARCHAR(100),
    ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15),
    ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10),
    ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100),
    ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'Regular',
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE IF NOT EXISTS gate_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN (
        'INBOUND', 'OUTBOUND', 'MATERIAL_TRANSFER', 'SCRAP', 'RETURN', 'SAMPLE'
    )),
    entry_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vehicle_number VARCHAR(50),
    driver_name VARCHAR(100),
    contact_number VARCHAR(20),
    purpose TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    )),
    reference_document_type VARCHAR(50), -- 'PURCHASE_ORDER', 'SALES_ORDER', 'MATERIAL_REQUEST', etc.
    reference_document_number VARCHAR(100),
    reference_document_id UUID, -- Link to the actual document
    source_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    destination_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ensure reference document columns exist for legacy schemas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'reference_document_type'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN reference_document_type VARCHAR(50);

        COMMENT ON COLUMN gate_entries.reference_document_type IS 'Type of reference document (e.g., PURCHASE_ORDER, SALES_ORDER, MATERIAL_REQUEST)';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'reference_document_number'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN reference_document_number VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'reference_document_id'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN reference_document_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'entry_date'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN entry_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

        COMMENT ON COLUMN gate_entries.entry_date IS 'Timestamp when the gate entry was recorded';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'source_location_id'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN source_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'destination_location_id'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN destination_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'vehicle_number'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN vehicle_number VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'driver_name'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN driver_name VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'contact_number'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN contact_number VARCHAR(20);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'purpose'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN purpose TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'gate_entries'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE gate_entries
        ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
            CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED'));
    END IF;
END $$;

-- =============================================
-- GATE ENTRY ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS gate_entry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_entry_id UUID NOT NULL REFERENCES gate_entries(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100),
    quantity DECIMAL(15,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price DECIMAL(15,2),
    total_price DECIMAL(15,2) GENERATED ALWAYS AS (quantity * COALESCE(unit_price, 0)) STORED,
    quality_status VARCHAR(20) DEFAULT 'PENDING' CHECK (quality_status IN (
        'PENDING', 'PASSED', 'FAILED', 'HOLD', 'QUARANTINE'
    )),
    quality_notes TEXT,
    inspected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'RECEIVED', 'PARTIALLY_RECEIVED', 'REJECTED', 'CANCELLED'
    )),
    received_quantity DECIMAL(15,3) DEFAULT 0,
    rejected_quantity DECIMAL(15,3) DEFAULT 0,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- FINISHED GOODS INVENTORY
-- =============================================
CREATE TABLE IF NOT EXISTS finished_goods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
    batch_number VARCHAR(100) NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    available_quantity DECIMAL(15,3) GENERATED ALWAYS AS (quantity - COALESCE(allocated_quantity, 0) - COALESCE(dispatched_quantity, 0)) STORED,
    allocated_quantity DECIMAL(15,3) DEFAULT 0,
    dispatched_quantity DECIMAL(15,3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    production_date DATE NOT NULL,
    expiry_date DATE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    quality_status VARCHAR(20) DEFAULT 'PENDING' CHECK (quality_status IN (
        'PENDING', 'PASSED', 'FAILED', 'HOLD', 'QUARANTINE', 'RELEASED'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN (
        'AVAILABLE', 'ALLOCATED', 'DISPATCHED', 'HOLD', 'QUARANTINE', 'SCRAPPED'
    )),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, batch_number, production_date)
);

-- Ensure production_date column exists for legacy schemas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'finished_goods'
          AND column_name = 'production_date'
    ) THEN
        ALTER TABLE finished_goods
        ADD COLUMN production_date DATE NOT NULL DEFAULT CURRENT_DATE;

        COMMENT ON COLUMN finished_goods.production_date IS 'Date when the finished good was produced';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'finished_goods'
          AND column_name = 'allocated_quantity'
    ) THEN
        ALTER TABLE finished_goods
        ADD COLUMN allocated_quantity DECIMAL(15,3) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'finished_goods'
          AND column_name = 'dispatched_quantity'
    ) THEN
        ALTER TABLE finished_goods
        ADD COLUMN dispatched_quantity DECIMAL(15,3) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'finished_goods'
          AND column_name = 'available_quantity'
    ) THEN
        ALTER TABLE finished_goods
        ADD COLUMN available_quantity DECIMAL(15,3) GENERATED ALWAYS AS (
            quantity - COALESCE(allocated_quantity, 0) - COALESCE(dispatched_quantity, 0)
        ) STORED;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'finished_goods'
          AND column_name = 'purchase_order_id'
    ) THEN
        ALTER TABLE finished_goods
        ADD COLUMN purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'finished_goods'
          AND column_name = 'work_order_id'
    ) THEN
        ALTER TABLE finished_goods
        ADD COLUMN work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL;
    END IF;
END $$;


-- =============================================
-- DISPATCH ORDERS
-- =============================================

CREATE TABLE IF NOT EXISTS dispatch_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(50) UNIQUE NOT NULL,
    dispatch_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    customer_reference VARCHAR(100),
    sales_order_number VARCHAR(100),
    delivery_address TEXT,
    contact_person VARCHAR(100),
    contact_number VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'CONFIRMED', 'PICKING', 'PACKED', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
    )),
    vehicle_number VARCHAR(50),
    driver_name VARCHAR(100),
    driver_contact VARCHAR(20),
    shipping_notes TEXT,
    total_quantity DECIMAL(15,3) DEFAULT 0,
    total_boxes INTEGER,
    total_weight DECIMAL(15,3),
    weight_unit VARCHAR(10) DEFAULT 'KG',
    is_invoiced BOOLEAN DEFAULT false,
    invoice_number VARCHAR(100),
    invoice_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Function to update dispatch order total quantity
CREATE OR REPLACE FUNCTION update_dispatch_order_total_quantity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        -- If this is an update or delete on dispatch_order_items
        -- Update the total_quantity for the old dispatch_order_id
        UPDATE dispatch_orders
        SET total_quantity = COALESCE((
            SELECT SUM(quantity) 
            FROM dispatch_order_items 
            WHERE dispatch_order_id = OLD.dispatch_order_id
            GROUP BY dispatch_order_id
        ), 0),
        updated_at = NOW()
        WHERE id = OLD.dispatch_order_id;
    END IF;
    
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- If this is an insert or update on dispatch_order_items
        -- Update the total_quantity for the new dispatch_order_id
        UPDATE dispatch_orders
        SET total_quantity = COALESCE((
            SELECT SUM(quantity) 
            FROM dispatch_order_items 
            WHERE dispatch_order_id = NEW.dispatch_order_id
            GROUP BY dispatch_order_id
        ), 0),
        updated_at = NOW()
        WHERE id = NEW.dispatch_order_id;
    END IF;
    
    RETURN NULL; -- For AFTER triggers, return value is ignored
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS dispatch_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_order_id UUID NOT NULL REFERENCES dispatch_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    finished_good_id UUID REFERENCES finished_goods(id) ON DELETE SET NULL,
    batch_number VARCHAR(100),
    quantity DECIMAL(15,3) NOT NULL,
    dispatched_quantity DECIMAL(15,3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) GENERATED ALWAYS AS ((quantity * unit_price * tax_percentage) / 100) STORED,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) GENERATED ALWAYS AS ((quantity * unit_price * discount_percentage) / 100) STORED,
    net_amount DECIMAL(15,2) GENERATED ALWAYS AS (
        (quantity * unit_price) + 
        ((quantity * unit_price * COALESCE(tax_percentage, 0)) / 100) - 
        ((quantity * unit_price * COALESCE(discount_percentage, 0)) / 100)
    ) STORED,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'ALLOCATED', 'PICKED', 'PACKED', 'LOADED', 'DISPATCHED', 'CANCELLED'
    )),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create triggers for dispatch_order_items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_dispatch_order_items_insert'
    ) THEN
        CREATE TRIGGER trg_dispatch_order_items_insert
        AFTER INSERT ON dispatch_order_items
        FOR EACH ROW
        EXECUTE FUNCTION update_dispatch_order_total_quantity();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_dispatch_order_items_update'
    ) THEN
        CREATE TRIGGER trg_dispatch_order_items_update
        AFTER UPDATE ON dispatch_order_items
        FOR EACH ROW
        WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity OR OLD.dispatch_order_id IS DISTINCT FROM NEW.dispatch_order_id)
        EXECUTE FUNCTION update_dispatch_order_total_quantity();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_dispatch_order_items_delete'
    ) THEN
        CREATE TRIGGER trg_dispatch_order_items_delete
        AFTER DELETE ON dispatch_order_items
        FOR EACH ROW
        EXECUTE FUNCTION update_dispatch_order_total_quantity();
    END IF;
END $$;

-- =============================================
-- DISPATCH ALLOCATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS dispatch_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_item_id UUID NOT NULL REFERENCES dispatch_order_items(id) ON DELETE CASCADE,
    finished_good_id UUID NOT NULL REFERENCES finished_goods(id) ON DELETE CASCADE,
    allocated_quantity DECIMAL(15,3) NOT NULL,
    dispatched_quantity DECIMAL(15,3) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ALLOCATED' CHECK (status IN (
        'ALLOCATED', 'PICKED', 'PACKED', 'LOADED', 'DISPATCHED', 'CANCELLED'
    )),
    picked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    picked_at TIMESTAMPTZ,
    packed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    packed_at TIMESTAMPTZ,
    loaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    loaded_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dispatch_item_id, finished_good_id)
);

-- =============================================
-- INDEXES
-- =============================================

SELECT ensure_index_exists('customers', 'idx_customers_customer_code', 'CREATE UNIQUE INDEX idx_customers_customer_code ON customers(customer_code);');
SELECT ensure_index_exists('customers', 'idx_customers_customer_name', 'CREATE INDEX idx_customers_customer_name ON customers(customer_name);');
SELECT ensure_index_exists('customers', 'idx_customers_status', 'CREATE INDEX idx_customers_status ON customers(status);');
SELECT ensure_index_exists('customers', 'idx_customers_customer_type', 'CREATE INDEX idx_customers_customer_type ON customers(customer_type);');
SELECT ensure_index_exists('gate_entries', 'idx_gate_entries_entry_type', 'CREATE INDEX idx_gate_entries_entry_type ON gate_entries(entry_type);');
SELECT ensure_index_exists('gate_entries', 'idx_gate_entries_status', 'CREATE INDEX idx_gate_entries_status ON gate_entries(status);');
SELECT ensure_index_exists('gate_entries', 'idx_gate_entries_reference_doc', 'CREATE INDEX idx_gate_entries_reference_doc ON gate_entries(reference_document_type, reference_document_id);');
SELECT ensure_index_exists('gate_entries', 'idx_gate_entries_entry_date', 'CREATE INDEX idx_gate_entries_entry_date ON gate_entries(entry_date);');

SELECT ensure_index_exists('gate_entry_items', 'idx_gate_entry_items_gate_entry_id', 'CREATE INDEX idx_gate_entry_items_gate_entry_id ON gate_entry_items(gate_entry_id);');
SELECT ensure_index_exists('gate_entry_items', 'idx_gate_entry_items_product_id', 'CREATE INDEX idx_gate_entry_items_product_id ON gate_entry_items(product_id);');
SELECT ensure_index_exists('gate_entry_items', 'idx_gate_entry_items_batch_number', 'CREATE INDEX idx_gate_entry_items_batch_number ON gate_entry_items(batch_number);');
SELECT ensure_index_exists('gate_entry_items', 'idx_gate_entry_items_quality_status', 'CREATE INDEX idx_gate_entry_items_quality_status ON gate_entry_items(quality_status);');

SELECT ensure_index_exists('finished_goods', 'idx_finished_goods_product_id', 'CREATE INDEX idx_finished_goods_product_id ON finished_goods(product_id);');
SELECT ensure_index_exists('finished_goods', 'idx_finished_goods_batch_number', 'CREATE INDEX idx_finished_goods_batch_number ON finished_goods(batch_number);');
SELECT ensure_index_exists('finished_goods', 'idx_finished_goods_purchase_order_id', 'CREATE INDEX idx_finished_goods_purchase_order_id ON finished_goods(purchase_order_id);');
SELECT ensure_index_exists('finished_goods', 'idx_finished_goods_work_order_id', 'CREATE INDEX idx_finished_goods_work_order_id ON finished_goods(work_order_id);');
SELECT ensure_index_exists('finished_goods', 'idx_finished_goods_status', 'CREATE INDEX idx_finished_goods_status ON finished_goods(status);');
SELECT ensure_index_exists('finished_goods', 'idx_finished_goods_quality_status', 'CREATE INDEX idx_finished_goods_quality_status ON finished_goods(quality_status);');
SELECT ensure_index_exists('finished_goods', 'idx_finished_goods_production_date', 'CREATE INDEX idx_finished_goods_production_date ON finished_goods(production_date);');
SELECT ensure_index_exists('finished_goods', 'idx_finished_goods_expiry_date', 'CREATE INDEX idx_finished_goods_expiry_date ON finished_goods(expiry_date);');

SELECT ensure_index_exists('dispatch_orders', 'idx_dispatch_orders_dispatch_number', 'CREATE INDEX idx_dispatch_orders_dispatch_number ON dispatch_orders(dispatch_number);');
SELECT ensure_index_exists('dispatch_orders', 'idx_dispatch_orders_status', 'CREATE INDEX idx_dispatch_orders_status ON dispatch_orders(status);');
SELECT ensure_index_exists('dispatch_orders', 'idx_dispatch_orders_customer_id', 'CREATE INDEX idx_dispatch_orders_customer_id ON dispatch_orders(customer_id);');
SELECT ensure_index_exists('dispatch_orders', 'idx_dispatch_orders_dispatch_date', 'CREATE INDEX idx_dispatch_orders_dispatch_date ON dispatch_orders(dispatch_date);');
SELECT ensure_index_exists('dispatch_orders', 'idx_dispatch_orders_sales_order_number', 'CREATE INDEX idx_dispatch_orders_sales_order_number ON dispatch_orders(sales_order_number);');

SELECT ensure_index_exists('dispatch_order_items', 'idx_dispatch_order_items_dispatch_order_id', 'CREATE INDEX idx_dispatch_order_items_dispatch_order_id ON dispatch_order_items(dispatch_order_id);');
SELECT ensure_index_exists('dispatch_order_items', 'idx_dispatch_order_items_product_id', 'CREATE INDEX idx_dispatch_order_items_product_id ON dispatch_order_items(product_id);');
SELECT ensure_index_exists('dispatch_order_items', 'idx_dispatch_order_items_finished_good_id', 'CREATE INDEX idx_dispatch_order_items_finished_good_id ON dispatch_order_items(finished_good_id);');

UPDATE dispatch_orders d_ord
SET total_quantity = COALESCE((
    SELECT SUM(quantity)
    FROM dispatch_order_items
    WHERE dispatch_order_id = d_ord.id
    GROUP BY dispatch_order_id
), 0);

SELECT ensure_index_exists('dispatch_allocations', 'idx_dispatch_allocations_dispatch_item_id', 'CREATE INDEX idx_dispatch_allocations_dispatch_item_id ON dispatch_allocations(dispatch_item_id);');
SELECT ensure_index_exists('dispatch_allocations', 'idx_dispatch_allocations_finished_good_id', 'CREATE INDEX idx_dispatch_allocations_finished_good_id ON dispatch_allocations(finished_good_id);');
SELECT ensure_index_exists('dispatch_allocations', 'idx_dispatch_allocations_status', 'CREATE INDEX idx_dispatch_allocations_status ON dispatch_allocations(status);');

-- =============================================
-- TRIGGERS
-- =============================================

-- Apply triggers to all tables with updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_customers_updated_at'
        AND tgrelid = 'customers'::regclass
    ) THEN
        CREATE TRIGGER update_customers_updated_at
        BEFORE UPDATE ON customers
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_gate_entry_items_updated_at'
        AND tgrelid = 'gate_entry_items'::regclass
    ) THEN
        CREATE TRIGGER update_gate_entry_items_updated_at
        BEFORE UPDATE ON gate_entry_items
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_finished_goods_updated_at'
        AND tgrelid = 'finished_goods'::regclass
    ) THEN
        CREATE TRIGGER update_finished_goods_updated_at
        BEFORE UPDATE ON finished_goods
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_dispatch_orders_updated_at'
        AND tgrelid = 'dispatch_orders'::regclass
    ) THEN
        CREATE TRIGGER update_dispatch_orders_updated_at
        BEFORE UPDATE ON dispatch_orders
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_dispatch_order_items_updated_at'
        AND tgrelid = 'dispatch_order_items'::regclass
    ) THEN
        CREATE TRIGGER update_dispatch_order_items_updated_at
        BEFORE UPDATE ON dispatch_order_items
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_dispatch_allocations_updated_at'
        AND tgrelid = 'dispatch_allocations'::regclass
    ) THEN
        CREATE TRIGGER update_dispatch_allocations_updated_at
        BEFORE UPDATE ON dispatch_allocations
        FOR EACH ROW EXECUTE FUNCTION update_timestamps();
    END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS gate_entry_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS dispatch_order_seq START WITH 1;

CREATE OR REPLACE FUNCTION generate_gate_entry_number()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(NEW.entry_number, '') = '' THEN
        NEW.entry_number := generate_sequential_number('GE', 'gate_entry_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_generate_gate_entry_number'
        AND tgrelid = 'gate_entries'::regclass
    ) THEN
        CREATE TRIGGER trg_generate_gate_entry_number
        BEFORE INSERT ON gate_entries
        FOR EACH ROW
        EXECUTE FUNCTION generate_gate_entry_number();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION generate_dispatch_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(NEW.dispatch_number, '') = '' THEN
        NEW.dispatch_number := generate_sequential_number('DO', 'dispatch_order_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_generate_dispatch_order_number'
        AND tgrelid = 'dispatch_orders'::regclass
    ) THEN
        CREATE TRIGGER trg_generate_dispatch_order_number
        BEFORE INSERT ON dispatch_orders
        FOR EACH ROW
        EXECUTE FUNCTION generate_dispatch_order_number();
    END IF;
END $$;

-- Function to update finished goods quantities when dispatch allocations change
CREATE OR REPLACE FUNCTION update_finished_goods_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- Update allocated quantity in finished_goods
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE finished_goods
        SET 
            allocated_quantity = allocated_quantity + NEW.allocated_quantity,
            updated_at = NOW()
        WHERE id = NEW.finished_good_id;
    END IF;
    
    -- Handle updates to dispatched quantity
    IF TG_OP = 'UPDATE' AND OLD.allocated_quantity <> NEW.allocated_quantity THEN
        UPDATE finished_goods
        SET 
            allocated_quantity = allocated_quantity - OLD.allocated_quantity + NEW.allocated_quantity,
            updated_at = NOW()
        WHERE id = NEW.finished_good_id;
    END IF;
    
    -- Handle deletes
    IF TG_OP = 'DELETE' THEN
        UPDATE finished_goods
        SET 
            allocated_quantity = allocated_quantity - OLD.allocated_quantity,
            updated_at = NOW()
        WHERE id = OLD.finished_good_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_update_finished_goods_quantities'
        AND tgrelid = 'dispatch_allocations'::regclass
    ) THEN
        CREATE TRIGGER trg_update_finished_goods_quantities
        AFTER INSERT OR UPDATE OR DELETE ON dispatch_allocations
        FOR EACH ROW
        EXECUTE FUNCTION update_finished_goods_quantities();
    END IF;
END $$;

-- =============================================
-- VIEWS
-- =============================================

-- Ensure reference_document_type column exists in gate_entries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'gate_entries' 
        AND column_name = 'reference_document_type'
    ) THEN
        ALTER TABLE gate_entries 
        ADD COLUMN reference_document_type VARCHAR(50);
        
        COMMENT ON COLUMN gate_entries.reference_document_type IS 'Type of reference document (e.g., PURCHASE_ORDER, SALES_ORDER, MATERIAL_REQUEST)';
    END IF;
END $$;

-- View for gate entry summary
CREATE OR REPLACE VIEW vw_gate_entry_summary AS
SELECT 
    ge.id,
    ge.entry_number,
    ge.entry_type,
    ge.entry_date,
    ge.vehicle_number,
    ge.status,
    ge.reference_document_type,
    ge.reference_document_number,
    sl.name AS source_location,
    dl.name AS destination_location,
    COUNT(gei.id) AS item_count,
    COALESCE(SUM(gei.quantity), 0) AS total_quantity,
    ge.created_at,
    ge.updated_at
FROM gate_entries ge
LEFT JOIN gate_entry_items gei ON ge.id = gei.gate_entry_id
LEFT JOIN locations sl ON ge.source_location_id = sl.id
LEFT JOIN locations dl ON ge.destination_location_id = dl.id
GROUP BY ge.id, sl.name, dl.name;

-- View for finished goods inventory
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'vw_finished_goods_inventory'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'vw_finished_goods_inventory'
              AND column_name = 'production_order_number'
        ) THEN
            EXECUTE 'ALTER VIEW vw_finished_goods_inventory RENAME COLUMN production_order_number TO purchase_order_number';
        END IF;
    END IF;
END $$;

CREATE OR REPLACE VIEW vw_finished_goods_inventory AS
SELECT 
    fg.id,
    p.code AS product_code,
    p.name AS product_name,
    p.description AS product_description,
    fg.batch_number,
    fg.quantity,
    fg.available_quantity,
    fg.allocated_quantity,
    fg.dispatched_quantity,
    fg.unit,
    fg.production_date,
    fg.expiry_date,
    l.name AS location_name,
    fg.quality_status,
    fg.status,
    po.order_number AS purchase_order_number,
    wo.work_order_number,
    fg.notes,
    fg.created_at,
    fg.updated_at
FROM finished_goods fg
JOIN products p ON fg.product_id = p.id
LEFT JOIN locations l ON fg.location_id = l.id
LEFT JOIN purchase_orders po ON fg.purchase_order_id = po.id
LEFT JOIN work_orders wo ON fg.work_order_id = wo.id;

-- View for dispatch order summary
CREATE OR REPLACE VIEW vw_dispatch_order_summary AS
SELECT 
    d_ord.id,
    d_ord.dispatch_number,
    d_ord.dispatch_date,
    d_ord.customer_name,
    d_ord.status,
    d_ord.sales_order_number,
    d_ord.vehicle_number,
    d_ord.driver_name,
    d_ord.total_quantity,
    d_ord.total_boxes,
    d_ord.total_weight || ' ' || d_ord.weight_unit AS total_weight,
    COUNT(DISTINCT doi.id) AS item_count,
    SUM(doi.quantity) AS total_items,
    SUM(doi.total_price) AS total_amount,
    d_ord.created_at,
    d_ord.updated_at
FROM dispatch_orders d_ord
LEFT JOIN dispatch_order_items doi ON d_ord.id = doi.dispatch_order_id
GROUP BY d_ord.id;

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default gate entry types if they don't exist
-- This would typically be done via application code, but included here for completeness

-- =============================================
-- COMMENTS
-- =============================================

-- Table comments
COMMENT ON TABLE customers IS 'Customer master data for dispatch orders and sales';
COMMENT ON TABLE gate_entries IS 'Records of all material movements through facility gates';
COMMENT ON TABLE gate_entry_items IS 'Line items for gate entries';
COMMENT ON TABLE finished_goods IS 'Inventory of finished goods ready for dispatch';
COMMENT ON TABLE dispatch_orders IS 'Orders for dispatching finished goods to customers';
COMMENT ON TABLE dispatch_order_items IS 'Line items for dispatch orders';
COMMENT ON TABLE dispatch_allocations IS 'Allocation of specific finished goods batches to dispatch items';

-- Column comments
COMMENT ON COLUMN gate_entries.entry_type IS 'Type of gate entry: INBOUND, OUTBOUND, MATERIAL_TRANSFER, etc.';
COMMENT ON COLUMN gate_entries.status IS 'Current status of the gate entry';
COMMENT ON COLUMN gate_entry_items.quality_status IS 'Quality status of the received material';
COMMENT ON COLUMN finished_goods.quality_status IS 'Quality status of the finished goods';
COMMENT ON COLUMN finished_goods.status IS 'Current status of the finished goods inventory';
COMMENT ON COLUMN dispatch_orders.status IS 'Current status of the dispatch order';
COMMENT ON COLUMN dispatch_order_items.status IS 'Current status of the dispatch item';
COMMENT ON COLUMN dispatch_allocations.status IS 'Current status of the allocation';

-- View comments
COMMENT ON VIEW vw_gate_entry_summary IS 'Summary view of gate entries with aggregated item information';
COMMENT ON VIEW vw_finished_goods_inventory IS 'Detailed view of finished goods inventory with product and location information';
COMMENT ON VIEW vw_dispatch_order_summary IS 'Summary view of dispatch orders with aggregated item information';
