-- =============================================
-- 014_material_transfer_module.sql
-- Module 7: Material Transfer (Purchase Order based)
-- =============================================

BEGIN;

-- 1. Core material_transfers table (single header referencing purchase orders)
CREATE TABLE IF NOT EXISTS material_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    reference_order_id UUID REFERENCES purchase_orders(id),
    from_location_id UUID NOT NULL REFERENCES locations(id),
    to_location_id UUID NOT NULL REFERENCES locations(id),
    transfer_type VARCHAR(50) NOT NULL DEFAULT 'Standard',
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    priority VARCHAR(20) NOT NULL DEFAULT 'Normal',
    reason TEXT,
    notes TEXT,
    requested_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    executed_by UUID REFERENCES users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    rejection_reason TEXT,
    slip_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_transfers_status ON material_transfers(status);
CREATE INDEX IF NOT EXISTS idx_material_transfers_order ON material_transfers(reference_order_id);
CREATE INDEX IF NOT EXISTS idx_material_transfers_locations ON material_transfers(from_location_id, to_location_id);

-- 2. Items table to support batch transfers (multiple materials per transfer)
CREATE TABLE IF NOT EXISTS material_transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES material_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    source_inventory_id UUID REFERENCES inventory(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (transfer_id, product_id, source_inventory_id)
);

CREATE INDEX IF NOT EXISTS idx_mti_transfer ON material_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_mti_product ON material_transfer_items(product_id);

-- 3. Approval tracking table for workflow history
CREATE TABLE IF NOT EXISTS material_transfer_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES material_transfers(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(30) NOT NULL, -- Approved, Rejected, Recalled, etc.
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mta_transfer ON material_transfer_approvals(transfer_id);
CREATE INDEX IF NOT EXISTS idx_mta_action ON material_transfer_approvals(action);

-- 4. Audit log for full traceability
CREATE TABLE IF NOT EXISTS material_transfer_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES material_transfers(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mtal_transfer ON material_transfer_audit_log(transfer_id);
CREATE INDEX IF NOT EXISTS idx_mtal_event ON material_transfer_audit_log(event_type);

-- 5. Trigger to keep updated_at in sync on main transfer table
CREATE OR REPLACE FUNCTION update_material_transfer_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_material_transfers_timestamp ON material_transfers;
CREATE TRIGGER trg_material_transfers_timestamp
BEFORE UPDATE ON material_transfers
FOR EACH ROW
EXECUTE FUNCTION update_material_transfer_timestamp();

COMMIT;
