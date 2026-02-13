-- =============================================
-- 008: MISSING TABLES
-- Add tables that were referenced in services but missing from migrations
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. MATERIAL TRANSFERS
-- =============================================
CREATE TABLE IF NOT EXISTS material_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    from_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    to_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    reason TEXT,
    notes TEXT,
    reference_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
    work_order_number VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled')),
    transfer_type VARCHAR(30) DEFAULT 'Standard' CHECK (transfer_type IN ('Standard', 'Emergency', 'Return', 'Adjustment')),
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_transfers_number ON material_transfers(transfer_number);
CREATE INDEX IF NOT EXISTS idx_material_transfers_product ON material_transfers(product_id);
CREATE INDEX IF NOT EXISTS idx_material_transfers_from_location ON material_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_material_transfers_to_location ON material_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_material_transfers_status ON material_transfers(status);
CREATE INDEX IF NOT EXISTS idx_material_transfers_requested_at ON material_transfers(requested_at DESC);

COMMENT ON TABLE material_transfers IS 'Material transfer requests between locations';
COMMENT ON COLUMN material_transfers.transfer_number IS 'Auto-generated unique transfer number in format TRF-YYYY-NNNN';

-- =============================================
-- 2. MATERIAL REQUESTS
-- =============================================
CREATE TABLE IF NOT EXISTS material_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    shift VARCHAR(50),
    request_date DATE NOT NULL,
    required_date DATE,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    delivery_instructions TEXT,
    priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    reference_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_by_name VARCHAR(200),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_name VARCHAR(200),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_name VARCHAR(200),
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Reviewed', 'Approved', 'Rejected', 'Partially Fulfilled', 'Fulfilled', 'Cancelled')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_requests_number ON material_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_material_requests_department ON material_requests(department);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_material_requests_request_date ON material_requests(request_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_requests_requested_by ON material_requests(requested_by);

COMMENT ON TABLE material_requests IS 'Material requests from departments';
COMMENT ON COLUMN material_requests.request_number IS 'Auto-generated unique request number in format MR-YYYY-NNNN';

-- =============================================
-- 3. REQUEST ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    item_code VARCHAR(100),
    material_description TEXT,
    requested_qty DECIMAL(15, 3) NOT NULL CHECK (requested_qty > 0),
    approved_qty DECIMAL(15, 3) DEFAULT 0,
    issued_qty DECIMAL(15, 3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    required_date DATE,
    location VARCHAR(200),
    priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High')),
    availability_status VARCHAR(30) CHECK (availability_status IN ('Available', 'Partial', 'Shortage')),
    available_stock DECIMAL(15, 3) DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Partially Issued', 'Issued')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_items_request ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_items_product ON request_items(product_id);
CREATE INDEX IF NOT EXISTS idx_request_items_status ON request_items(status);

COMMENT ON TABLE request_items IS 'Line items for material requests';

-- =============================================
-- 4. STOCK ALERTS
-- =============================================
CREATE TABLE IF NOT EXISTS stock_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    min_qty DECIMAL(15, 3) NOT NULL CHECK (min_qty >= 0),
    reorder_qty DECIMAL(15, 3),
    alert_type VARCHAR(30) DEFAULT 'low_stock' CHECK (alert_type IN ('low_stock', 'out_of_stock', 'expiry', 'custom')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (product_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_location ON stock_alerts(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_active ON stock_alerts(is_active);

COMMENT ON TABLE stock_alerts IS 'Stock alert configurations for products at specific locations';

-- =============================================
-- 5. STOCK ALERTS ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS stock_alerts_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('LOW_STOCK', 'OUT_OF_STOCK', 'REORDER', 'EXPIRY')),
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    current_quantity DECIMAL(15, 3),
    threshold_quantity DECIMAL(15, 3),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_items_inventory ON stock_alerts_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_items_status ON stock_alerts_items(status);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_items_created ON stock_alerts_items(created_at DESC);

COMMENT ON TABLE stock_alerts_items IS 'Individual stock alert instances for inventory items';

-- =============================================
-- 6. QUICK REQUEST TEMPLATES
-- =============================================
CREATE TABLE IF NOT EXISTS quick_request_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    default_quantity DECIMAL(15, 3) NOT NULL CHECK (default_quantity > 0),
    unit VARCHAR(20) NOT NULL,
    destination_location VARCHAR(200),
    department VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quick_request_templates_product ON quick_request_templates(product_id);
CREATE INDEX IF NOT EXISTS idx_quick_request_templates_active ON quick_request_templates(is_active);

COMMENT ON TABLE quick_request_templates IS 'Quick action templates for frequently requested materials';

-- =============================================
-- 7. GATE ENTRY MATERIALS
-- =============================================
-- Note: If gate_entry_items exists, it should be dropped or renamed first
-- Check: SELECT COUNT(*) FROM gate_entry_items;
-- If needed: DROP TABLE IF EXISTS gate_entry_items CASCADE;

CREATE TABLE IF NOT EXISTS gate_entry_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_entry_id UUID NOT NULL REFERENCES gate_entries(id) ON DELETE CASCADE,
    material_code VARCHAR(100),
    material_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    uom VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_entry_materials_entry ON gate_entry_materials(gate_entry_id);

COMMENT ON TABLE gate_entry_materials IS 'Materials/items in gate entries';

-- =============================================
-- 8. ORDER TEAM ASSIGNMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS order_team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (purchase_order_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_order_team_assignments_order ON order_team_assignments(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_order_team_assignments_user ON order_team_assignments(user_id);

COMMENT ON TABLE order_team_assignments IS 'Team member assignments to purchase orders';

-- =============================================
-- 9. BOM VERSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS bom_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    effective_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (bom_id, version)
);

CREATE INDEX IF NOT EXISTS idx_bom_versions_bom ON bom_versions(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_versions_effective_date ON bom_versions(effective_date DESC);

COMMENT ON TABLE bom_versions IS 'Version history for BOMs';

-- =============================================
-- 10. TRIGGERS
-- =============================================
CREATE TRIGGER update_material_transfers_timestamp BEFORE UPDATE ON material_transfers
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

CREATE TRIGGER update_material_requests_timestamp BEFORE UPDATE ON material_requests
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

CREATE TRIGGER update_request_items_timestamp BEFORE UPDATE ON request_items
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

CREATE TRIGGER update_stock_alerts_timestamp BEFORE UPDATE ON stock_alerts
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

CREATE TRIGGER update_stock_alerts_items_timestamp BEFORE UPDATE ON stock_alerts_items
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

CREATE TRIGGER update_quick_request_templates_timestamp BEFORE UPDATE ON quick_request_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

CREATE TRIGGER update_gate_entry_materials_timestamp BEFORE UPDATE ON gate_entry_materials
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

-- =============================================
-- 11. DOCUMENT SEQUENCES
-- =============================================
INSERT INTO document_sequences (document_type, prefix, sequence_format, next_sequence)
VALUES 
    ('MATERIAL_TRANSFER', 'TRF-', '000000', 1),
    ('MATERIAL_REQUEST', 'MR-', '000000', 1)
ON CONFLICT (document_type) DO NOTHING;

-- =============================================
-- 12. VERIFICATION
-- =============================================
COMMENT ON SCHEMA public IS 'Migration 008: Added missing tables - material_transfers, material_requests, request_items, stock_alerts, stock_alerts_items, quick_request_templates, gate_entry_materials, order_team_assignments, bom_versions';
