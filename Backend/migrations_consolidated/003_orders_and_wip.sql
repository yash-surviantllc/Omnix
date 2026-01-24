-- =============================================
-- 003: ORDERS, WIP & QC
-- Unified Migration for Omnix Manufacturing
-- Unified Standard: Title Case (Planned, Pending, etc.)
-- Merged from 003, 006, 008, 011, 012
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
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    completed_quantity DECIMAL(15, 3) DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. WORKSTATIONS & WORK ORDERS
CREATE TABLE IF NOT EXISTS workstations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location_id UUID REFERENCES locations(id),
    is_active BOOLEAN DEFAULT TRUE,
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
    status VARCHAR(30) NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned', 'Released', 'In Progress', 'On Hold', 'Completed', 'Cancelled')),
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    operation VARCHAR(100) NOT NULL,
    workstation_id UUID REFERENCES workstations(id),
    workstation_name VARCHAR(100),
    assigned_team VARCHAR(100),
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    shift VARCHAR(20) CHECK (shift IN ('Morning', 'Afternoon', 'Night', 'Custom')),
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
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity_checked NUMERIC NOT NULL DEFAULT 0,
    passed_qty NUMERIC NOT NULL DEFAULT 0,
    rework_qty NUMERIC NOT NULL DEFAULT 0,
    scrap_qty NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    inspector_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. WIP STAGES & TRACKING
CREATE TABLE IF NOT EXISTS wip_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    sequence_number INTEGER NOT NULL UNIQUE,
    target_avg_time_minutes NUMERIC(10,2) NOT NULL DEFAULT 30,
    color VARCHAR(20) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_stage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES purchase_orders(id),
    current_stage_id UUID NOT NULL REFERENCES wip_stages(id),
    quantity_in_stage NUMERIC(15,3) NOT NULL DEFAULT 0,
    entered_stage_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_id, current_stage_id)
);

-- 5. VIEWS & FUNCTIONS
CREATE OR REPLACE VIEW vw_work_order_status AS
SELECT wo.id, wo.work_order_number, wo.status, wo.priority, wo.target_qty, wo.completed_qty, wo.rejected_qty, wo.operation, wo.scheduled_start, wo.scheduled_end, po.order_number AS purchase_order_number, p.code AS product_code, p.name AS product_name
FROM work_orders wo LEFT JOIN purchase_orders po ON po.id = wo.purchase_order_id LEFT JOIN products p ON p.id = wo.product_id;

CREATE OR REPLACE FUNCTION generate_wo_number() RETURNS TRIGGER AS $$
BEGIN IF NEW.work_order_number IS NULL THEN NEW.work_order_number := generate_document_number('WORK_ORDER'); END IF; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wo_number ON work_orders;
CREATE TRIGGER trg_wo_number BEFORE INSERT ON work_orders FOR EACH ROW EXECUTE FUNCTION generate_wo_number();

-- 6. WIP METRICS & TRANSFERS
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
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wip_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES purchase_orders(id),
    from_stage_id UUID REFERENCES wip_stages(id),
    to_stage_id UUID NOT NULL REFERENCES wip_stages(id),
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Completed',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ DEFAULT NOW(),
    actual_time_minutes DECIMAL(10,2),
    notes TEXT,
    transferred_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE SEQUENCE IF NOT EXISTS wip_transfer_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS working_order_seq START WITH 1;

-- RPC for Backend Service to get next sequence
CREATE OR REPLACE FUNCTION next_working_order_seq()
RETURNS INT AS $$
BEGIN
    RETURN nextval('working_order_seq');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_wip_stage_metrics()
RETURNS void AS $$
BEGIN
    UPDATE wip_stage_metrics sm
    SET 
        orders_count = COALESCE(wo_stats.order_count, 0),
        units_count = COALESCE(wo_stats.total_units, 0),
        avg_time_minutes = COALESCE(wo_stats.avg_duration, 0),
        utilization_percentage = CASE 
            WHEN sm.target_time_minutes > 0 THEN 
                LEAST(100, (COALESCE(wo_stats.avg_duration, 0) / sm.target_time_minutes * 100))
            ELSE 0
        END,
        health_status = CASE
            WHEN COALESCE(wo_stats.avg_duration, 0) <= sm.target_time_minutes THEN 'healthy'
            WHEN COALESCE(wo_stats.avg_duration, 0) <= sm.target_time_minutes * 1.2 THEN 'warning'
            ELSE 'delayed'
        END,
        updated_at = NOW()
    FROM (
        SELECT 
            operation,
            COUNT(DISTINCT purchase_order_id) as order_count,
            SUM(target_qty) as total_units,
            AVG(EXTRACT(EPOCH FROM (COALESCE(actual_end, NOW()) - COALESCE(actual_start, scheduled_start))) / 60) as avg_duration
        FROM work_orders
        WHERE status IN ('In Progress', 'Planned')
        GROUP BY operation
    ) wo_stats
    WHERE sm.stage_name = wo_stats.operation;
END;
$$ LANGUAGE plpgsql;

-- SEED WIP STAGES
INSERT INTO wip_stages (name, code, sequence_number, target_avg_time_minutes, color)
VALUES
    ('Material Planning', 'PLANNING', 1, 30, '#6366F1'),
    ('Cutting', 'CUTTING', 2, 45, '#8B5CF6'),
    ('Sewing', 'SEWING', 3, 120, '#EC4899'),
    ('Quality Check', 'QC', 4, 20, '#10B981'),
    ('Packaging', 'PACKAGING', 5, 15, '#F59E0B'),
    ('Dispatch', 'DISPATCH', 6, 10, '#3B82F6')
ON CONFLICT (code) DO NOTHING;
