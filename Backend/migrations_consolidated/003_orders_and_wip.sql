-- =============================================
-- 003: ORDERS, WIP & QC
-- Unified Migration for Omnix Manufacturing
-- Consolidation of: 003, 005, 006, 009, 010, 011, 012
-- =============================================

SET search_path TO public;

-- 1. PURCHASE ORDERS & ITEMS
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Planned', 'Released', 'In Progress', 'Completed', 'Cancelled')),
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    due_date TIMESTAMPTZ,
    customer_name VARCHAR(255),
    bom_id UUID REFERENCES boms(id),
    bom_version INTEGER,
    bom_snapshot JSONB,
    quantity_completed DECIMAL(15, 3) DEFAULT 0,
    rejected_qty DECIMAL(15, 3) DEFAULT 0,
    notes TEXT,
    -- From 006: Additional fields
    shift_number VARCHAR(50),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    ocr_document_url TEXT,
    ocr_extracted_data JSONB,
    qr_code TEXT,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_priority ON purchase_orders(priority);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_due_date ON purchase_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_product ON purchase_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(created_by);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    completed_quantity DECIMAL(15, 3) DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. WORKSTATIONS & WORK ORDERS
CREATE TABLE IF NOT EXISTS workstations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location_id UUID REFERENCES locations(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number VARCHAR(50) UNIQUE NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    target_qty DECIMAL(15, 3) NOT NULL CHECK (target_qty > 0),
    completed_qty DECIMAL(15, 3) DEFAULT 0,
    rejected_qty DECIMAL(15, 3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Planned' CHECK (status IN ('Pending', 'Draft', 'Planned', 'Released', 'In Progress', 'On Hold', 'Completed', 'Cancelled')),
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    operation VARCHAR(100) NOT NULL,
    workstation_id UUID REFERENCES workstations(id),
    workstation_name VARCHAR(100),
    assigned_team VARCHAR(100),
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    shift VARCHAR(20) CHECK (shift IN ('Morning', 'Afternoon', 'Evening', 'Night', 'Custom')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_work_orders_operation ON work_orders(operation);
CREATE INDEX IF NOT EXISTS idx_work_orders_workstation ON work_orders(workstation_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_team ON work_orders(assigned_team);

CREATE TABLE IF NOT EXISTS work_order_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES products(id),
    required_qty DECIMAL(15,3) NOT NULL,
    allocated_qty DECIMAL(15,3) DEFAULT 0,
    issued_qty DECIMAL(15,3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Allocated', 'Issued', 'Shortage')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_order_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    operation_name VARCHAR(100) NOT NULL,
    sequence_number INTEGER NOT NULL,
    workstation_id UUID REFERENCES workstations(id),
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Skipped')),
    completed_qty DECIMAL(15, 3) DEFAULT 0, -- From 010
    rejected_qty DECIMAL(15, 3) DEFAULT 0,  -- From 010
    planned_start TIMESTAMPTZ,
    planned_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wo_op_seq UNIQUE (work_order_id, sequence_number)
);

-- 3. MATERIALS & QC
CREATE TABLE IF NOT EXISTS order_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    required_qty DECIMAL(15, 3) NOT NULL,
    allocated_qty DECIMAL(15, 3) DEFAULT 0,
    issued_qty DECIMAL(15, 3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    availability_status VARCHAR(20) DEFAULT 'Available' CHECK (availability_status IN ('Available', 'Partial', 'Shortage')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qc_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_number TEXT NOT NULL UNIQUE,
    purchase_order_id UUID REFERENCES purchase_orders(id),
    work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity_checked NUMERIC NOT NULL DEFAULT 0,
    passed_qty NUMERIC NOT NULL DEFAULT 0,
    rework_qty NUMERIC NOT NULL DEFAULT 0,
    scrap_qty NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    inspector_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_qc_order_ref CHECK (purchase_order_id IS NOT NULL OR work_order_id IS NOT NULL)
);

-- 4. WIP STAGES & CONFIGURATION
CREATE TABLE IF NOT EXISTS wip_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    sequence_number INTEGER NOT NULL UNIQUE,
    target_avg_time_minutes NUMERIC(10,2) NOT NULL DEFAULT 30,
    color VARCHAR(20) DEFAULT '#3B82F6',
    description TEXT,
    icon VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- From 005_configurable_stages: ADD METADATA TO WIP_STAGES (Handled above in table definition)

-- 4.1 PRODUCT-SPECIFIC STAGE ASSIGNMENTS
CREATE TABLE IF NOT EXISTS product_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES wip_stages(id) ON DELETE RESTRICT,
    sequence_number INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    estimated_time_minutes NUMERIC(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_product_stage UNIQUE(product_id, stage_id),
    CONSTRAINT uq_product_sequence UNIQUE(product_id, sequence_number),
    CONSTRAINT chk_sequence_positive CHECK (sequence_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_product_stages_product ON product_stages(product_id);

-- 4.2 CONFIGURABLE STAGES (From 006_stage_config_junction)
CREATE TABLE IF NOT EXISTS config_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id VARCHAR(100) NOT NULL,
    stage_id UUID NOT NULL REFERENCES wip_stages(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    estimated_time_minutes DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_config_stage_rel UNIQUE(config_id, stage_id),
    CONSTRAINT uq_config_sequence UNIQUE(config_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_config_stages_id ON config_stages(config_id);

CREATE TABLE IF NOT EXISTS order_stage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE, -- From 012: Retargeted to work_orders
    current_stage_id UUID NOT NULL REFERENCES wip_stages(id),
    quantity_in_stage NUMERIC(15,3) NOT NULL DEFAULT 0,
    entered_stage_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_id, current_stage_id)
);

-- 5. WIP METRICS & TRANSFERS
CREATE TABLE IF NOT EXISTS wip_stage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_name VARCHAR(100) UNIQUE NOT NULL,
    stage_sequence INT NOT NULL,
    orders_count INT DEFAULT 0,
    units_count INT DEFAULT 0,
    avg_time_minutes DECIMAL(10,2) DEFAULT 0,
    target_time_minutes DECIMAL(10,2) NOT NULL,
    utilization_percentage DECIMAL(5,2) DEFAULT 0,
    health_status VARCHAR(20) DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'warning', 'delayed')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- From 011: FIX WIP TRANSFERS (wip_stage_transfers)
CREATE TABLE IF NOT EXISTS wip_stage_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES wip_stages(id),
    to_stage_id UUID NOT NULL REFERENCES wip_stages(id),
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'units',
    actual_time_minutes DECIMAL(10,2),
    notes TEXT,
    transferred_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wip_stage_transfers_order ON wip_stage_transfers(order_id);
CREATE INDEX IF NOT EXISTS idx_wip_stage_transfers_created ON wip_stage_transfers(created_at);

CREATE TABLE IF NOT EXISTS stage_performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    orders_processed INT DEFAULT 0,
    units_processed INT DEFAULT 0,
    avg_time_minutes DECIMAL(10,2) DEFAULT 0,
    utilization_percentage DECIMAL(5,2) DEFAULT 0,
    efficiency_percentage DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stage_name, date)
);

-- 6. SHIFT MANAGEMENT
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. VIEWS & FUNCTIONS
CREATE OR REPLACE VIEW vw_work_order_status AS
SELECT wo.id, wo.work_order_number, wo.status, wo.priority, wo.target_qty, wo.completed_qty, wo.rejected_qty, wo.operation, wo.scheduled_start, wo.scheduled_end, po.order_number AS purchase_order_number, p.code AS product_code, p.name AS product_name
FROM work_orders wo 
LEFT JOIN purchase_orders po ON po.id = wo.purchase_order_id 
LEFT JOIN products p ON p.id = wo.product_id;

-- From 006_stage_config_junction: STAGE USAGE VIEWS
CREATE OR REPLACE VIEW vw_stage_usage AS
SELECT 
    ws.id as stage_id,
    ws.name as stage_name,
    COUNT(DISTINCT ps.product_id) as assigned_products,
    COUNT(DISTINCT cs.config_id) as assigned_configs,
    COUNT(DISTINCT ost.order_id) as active_orders
FROM wip_stages ws
LEFT JOIN product_stages ps ON ws.id = ps.stage_id
LEFT JOIN config_stages cs ON ws.id = cs.stage_id
LEFT JOIN order_stage_tracking ost ON ws.id = ost.current_stage_id
GROUP BY ws.id, ws.name;

CREATE OR REPLACE VIEW vw_stage_config_usage AS
SELECT 
    config_id,
    COUNT(stage_id) as stages_count,
    SUM(estimated_time_minutes) as total_estimated_time,
    MAX(updated_at) as last_updated
FROM config_stages
GROUP BY config_id;

-- HELPERS
CREATE OR REPLACE FUNCTION generate_wo_number() RETURNS TRIGGER AS $$
BEGIN IF NEW.work_order_number IS NULL THEN NEW.work_order_number := generate_document_number('WORK_ORDER'); END IF; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wo_number ON work_orders;
CREATE TRIGGER trg_wo_number BEFORE INSERT ON work_orders FOR EACH ROW EXECUTE FUNCTION generate_wo_number();

-- From 005_configurable_stages: STAGE USAGE TRACKING
CREATE OR REPLACE FUNCTION is_stage_in_use(p_stage_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM product_stages WHERE stage_id = p_stage_id) OR
           EXISTS (SELECT 1 FROM order_stage_tracking WHERE current_stage_id = p_stage_id) OR
           EXISTS (SELECT 1 FROM config_stages WHERE stage_id = p_stage_id);
END;
$$ LANGUAGE plpgsql;

-- From 005_configurable_stages: STAGE SELECTORS
-- Returns stages configured for a specific product, or default stages if none configured
CREATE OR REPLACE FUNCTION get_product_stages(p_product_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    code VARCHAR(50),
    sequence_number INTEGER,
    target_avg_time_minutes NUMERIC(10,2),
    color VARCHAR(20),
    icon VARCHAR(50),
    description TEXT,
    is_required BOOLEAN,
    is_active BOOLEAN
) AS $$
BEGIN
    -- Check if product has specific stage assignments
    IF EXISTS (SELECT 1 FROM product_stages WHERE product_id = p_product_id) THEN
        -- Return product-specific stages
        RETURN QUERY
        SELECT 
            ws.id, ws.name, ws.code, ps.sequence_number, 
            COALESCE(ps.estimated_time_minutes, ws.target_avg_time_minutes) as target_avg_time_minutes,
            ws.color, ws.icon, ws.description, ps.is_required, ws.is_active
        FROM product_stages ps
        JOIN wip_stages ws ON ps.stage_id = ws.id
        WHERE ps.product_id = p_product_id
        AND ws.is_active = TRUE
        ORDER BY ps.sequence_number;
    ELSE
        -- Return default active stages from 'default' config if exists, otherwise from wip_stages table
        IF EXISTS (SELECT 1 FROM config_stages WHERE config_id = 'default') THEN
            RETURN QUERY
            SELECT 
                ws.id, ws.name, ws.code, cs.sequence_number, 
                COALESCE(cs.estimated_time_minutes, ws.target_avg_time_minutes),
                ws.color, ws.icon, ws.description, cs.is_required, ws.is_active
            FROM config_stages cs
            JOIN wip_stages ws ON cs.stage_id = ws.id
            WHERE cs.config_id = 'default'
            AND ws.is_active = TRUE
            ORDER BY cs.sequence_number;
        ELSE
            RETURN QUERY
            SELECT 
                ws.id, ws.name, ws.code, ws.sequence_number, 
                ws.target_avg_time_minutes, ws.color, ws.icon, ws.description, 
                TRUE as is_required, ws.is_active
            FROM wip_stages ws
            WHERE ws.is_active = TRUE
            ORDER BY ws.sequence_number;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- From 006_stage_config_junction: CONFIG SELECTORS
CREATE OR REPLACE FUNCTION get_config_stages(p_config_id VARCHAR)
RETURNS TABLE (
    stage_id UUID,
    stage_name VARCHAR,
    stage_code VARCHAR,
    sequence_number INTEGER,
    estimated_time DECIMAL,
    is_required BOOLEAN,
    color VARCHAR,
    icon VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ws.id, ws.name, ws.code, cs.sequence_number, 
        COALESCE(cs.estimated_time_minutes, ws.target_avg_time_minutes),
        cs.is_required, ws.color, ws.icon
    FROM config_stages cs
    JOIN wip_stages ws ON cs.stage_id = ws.id
    WHERE cs.config_id = p_config_id
    ORDER BY cs.sequence_number;
END;
$$ LANGUAGE plpgsql;

-- From 006_stage_config_junction: LIST ALL CONFIGS
CREATE OR REPLACE FUNCTION get_stage_configs()
RETURNS TABLE (config_id VARCHAR, stages_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT cs.config_id, COUNT(cs.stage_id)
    FROM config_stages cs
    GROUP BY cs.config_id
    ORDER BY cs.config_id;
END;
$$ LANGUAGE plpgsql;

-- 7. FUNCTIONS
-- Improved WIP Stage Metrics Update (includes utilization formula and health status)
CREATE OR REPLACE FUNCTION update_wip_stage_metrics()
RETURNS void AS $$
BEGIN
    -- Use CTE to calculate stats for ALL stages (Left Join from wip_stages)
    WITH stage_stats AS (
        SELECT 
            s.name as stage_name,
            -- Count all orders in the pipe (Planned + In Progress)
            COUNT(DISTINCT wo.purchase_order_id) FILTER (WHERE wo.id IS NOT NULL) as order_count,
            
            -- Sum units
            COALESCE(SUM(wo.target_qty), 0) as total_units,
            
            -- Avg Duration: ONLY for orders that have actually started (In Progress, or Completed)
            -- We exclude Planned orders (actual_start IS NULL)
            COALESCE(
                AVG(
                    CASE 
                        WHEN wo.actual_start IS NOT NULL THEN
                            EXTRACT(EPOCH FROM (COALESCE(wo.actual_end, NOW()) - wo.actual_start)) / 60
                        ELSE NULL 
                    END
                ), 
                0
            ) as avg_duration
        FROM wip_stages s
        LEFT JOIN work_orders wo ON s.name = wo.operation 
            AND wo.status IN ('In Progress', 'Planned')
        GROUP BY s.name
    )
    UPDATE wip_stage_metrics sm
    SET 
        orders_count = ss.order_count,
        units_count = ss.total_units,
        avg_time_minutes = ss.avg_duration,
        
        -- Utilization Formula: (Target / Actual) * 100
        utilization_percentage = CASE 
            WHEN ss.avg_duration > 0 THEN 
                (sm.target_time_minutes / ss.avg_duration * 100)
            ELSE 0 -- No actual work yet
        END,
        
        -- Health Status Logic
        -- < 80%: Delayed (Underutilization/Slow)
        -- 80% - 110%: Healthy (Optimal)
        -- > 110%: Warning (Overutilization/Too Fast)
        health_status = CASE
            WHEN ss.avg_duration = 0 THEN 'healthy' -- No activity
            WHEN (sm.target_time_minutes / ss.avg_duration * 100) < 80 THEN 'delayed'
            WHEN (sm.target_time_minutes / ss.avg_duration * 100) > 110 THEN 'warning'
            ELSE 'healthy'
        END,
        
        updated_at = NOW()
    FROM stage_stats ss
    WHERE sm.stage_name = ss.stage_name;
END;
$$ LANGUAGE plpgsql;

-- 7.1 TRIGGERS
-- From 005: PREVENT DELETION OF STAGES IN USE
CREATE OR REPLACE FUNCTION prevent_stage_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF is_stage_in_use(OLD.id) THEN
        RAISE EXCEPTION 'Cannot delete stage as it is currently assigned to products, configurations, or active orders.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_stage_deletion ON wip_stages;
CREATE TRIGGER trg_prevent_stage_deletion
    BEFORE DELETE ON wip_stages
    FOR EACH ROW EXECUTE FUNCTION prevent_stage_deletion();

-- From 005: TIMESTAMP TRIGGERS
DROP TRIGGER IF EXISTS trg_product_stages_timestamp ON product_stages;
CREATE TRIGGER trg_product_stages_timestamp
    BEFORE UPDATE ON product_stages
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

-- From 006: JTI TIMESTAMP TRIGGERS
DROP TRIGGER IF EXISTS trg_config_stages_timestamp ON config_stages;
CREATE TRIGGER trg_config_stages_timestamp
    BEFORE UPDATE ON config_stages
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

-- From 005: SEQUENCE VALIDATION
CREATE OR REPLACE FUNCTION validate_stage_sequence()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sequence_number <= 0 THEN
        RAISE EXCEPTION 'Sequence number must be positive.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_stage_sequence ON product_stages;
CREATE TRIGGER trg_validate_stage_sequence
    BEFORE INSERT OR UPDATE ON product_stages
    FOR EACH ROW EXECUTE FUNCTION validate_stage_sequence();

DROP TRIGGER IF EXISTS trg_validate_config_sequence ON config_stages;
CREATE TRIGGER trg_validate_config_sequence
    BEFORE INSERT OR UPDATE ON config_stages
    FOR EACH ROW EXECUTE FUNCTION validate_stage_sequence();

-- 8. SEED DATA
INSERT INTO shifts (name, start_time, end_time) VALUES
    ('Morning', '06:00', '14:00'),
    ('Afternoon', '14:00', '22:00'),
    ('Night', '22:00', '06:00'),
    ('Custom', '09:00', '17:00')
ON CONFLICT (name) DO NOTHING;

INSERT INTO wip_stages (id, name, code, sequence_number, target_avg_time_minutes, color, icon, description)
VALUES
    ('00000000-0000-0000-0002-000000000001', 'Material Planning', 'PLANNING', 1, 30, '#6366F1', 'ClipboardList', 'Material planning and preparation'),
    ('00000000-0000-0000-0002-000000000002', 'Cutting', 'CUTTING', 2, 45, '#8B5CF6', 'Scissors', 'Fabric cutting and pattern preparation'),
    ('00000000-0000-0000-0002-000000000003', 'Sewing', 'SEWING', 3, 120, '#EC4899', 'Shirt', 'Sewing and assembly operations'),
    ('00000000-0000-0000-0002-000000000004', 'Quality Check', 'QC', 4, 20, '#10B981', 'CheckCircle', 'Quality control and inspection'),
    ('00000000-0000-0000-0002-000000000005', 'Packaging', 'PACKAGING', 5, 15, '#F59E0B', 'Package', 'Final packaging and labeling'),
    ('00000000-0000-0000-0002-000000000006', 'Dispatch', 'DISPATCH', 6, 10, '#3B82F6', 'Truck', 'Ready for dispatch')
ON CONFLICT (code) DO NOTHING;

-- From 006_stage_config_junction: SEED INITIAL CONFIGS (Legacy Migration path)
DO $$
BEGIN
    -- 1. Seed metrics rows if missing
    INSERT INTO wip_stage_metrics (stage_name, stage_sequence, target_time_minutes)
    SELECT name, sequence_number, COALESCE(target_avg_time_minutes, 30)
    FROM wip_stages
    ON CONFLICT (stage_name) DO NOTHING;

    -- 2. Seed default config if empty
    IF NOT EXISTS (SELECT 1 FROM config_stages) THEN
        INSERT INTO config_stages (config_id, stage_id, sequence_number, is_required)
        SELECT 'default' as config_id, id as stage_id, sequence_number, true
        FROM wip_stages
        ORDER BY sequence_number;
    END IF;

    -- 3. Initial metrics calculation
    PERFORM update_wip_stage_metrics();
END $$;
