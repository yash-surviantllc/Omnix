-- WIP STAGES TABLE
CREATE TABLE IF NOT EXISTS wip_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    sequence_number INTEGER NOT NULL UNIQUE,
    target_avg_time_minutes DECIMAL(10,2) NOT NULL DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    location_id UUID REFERENCES locations(id),
    color VARCHAR(20) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_wip_stages_code ON wip_stages(code);
CREATE INDEX IF NOT EXISTS idx_wip_stages_sequence ON wip_stages(sequence_number);

-- WIP TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS wip_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES purchase_orders(id),
    from_stage_id UUID REFERENCES wip_stages(id),
    to_stage_id UUID NOT NULL REFERENCES wip_stages(id),
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Completed',
    start_time TIMESTAMP,
    end_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actual_time_minutes DECIMAL(10,2),
    notes TEXT,
    transferred_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wip_transfers_order ON wip_transfers(order_id);
CREATE INDEX IF NOT EXISTS idx_wip_transfers_to_stage ON wip_transfers(to_stage_id);
CREATE INDEX IF NOT EXISTS idx_wip_transfers_created ON wip_transfers(created_at DESC);

-- ORDER STAGE TRACKING TABLE
CREATE TABLE IF NOT EXISTS order_stage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES purchase_orders(id),
    current_stage_id UUID NOT NULL REFERENCES wip_stages(id),
    quantity_in_stage DECIMAL(15,3) NOT NULL DEFAULT 0,
    entered_stage_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (order_id, current_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_order_stage_tracking_stage ON order_stage_tracking(current_stage_id);

-- DEFAULT STAGES
INSERT INTO wip_stages (name, code, sequence_number, target_avg_time_minutes, color) VALUES 
    ('Material Planning', 'PLANNING', 1, 30, '#6366F1'),
    ('Cutting', 'CUTTING', 2, 45, '#8B5CF6'),
    ('Sewing', 'SEWING', 3, 120, '#EC4899'),
    ('Quality Check', 'QC', 4, 20, '#10B981'),
    ('Packaging', 'PACKAGING', 5, 15, '#F59E0B'),
    ('Dispatch', 'DISPATCH', 6, 10, '#3B82F6')
ON CONFLICT (code) DO NOTHING;

-- TRIGGERS
DROP TRIGGER IF EXISTS update_wip_stages_updated_at ON wip_stages;
CREATE TRIGGER update_wip_stages_updated_at BEFORE UPDATE ON wip_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wip_transfers_updated_at ON wip_transfers;
CREATE TRIGGER update_wip_transfers_updated_at BEFORE UPDATE ON wip_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_stage_tracking_updated_at ON order_stage_tracking;
CREATE TRIGGER update_order_stage_tracking_updated_at BEFORE UPDATE ON order_stage_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE SEQUENCE IF NOT EXISTS wip_transfer_seq START WITH 1;
