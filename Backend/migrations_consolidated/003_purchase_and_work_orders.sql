-- =============================================
-- PRODUCTION & WORK ORDERS CONSOLIDATED SCHEMA (MODULE 003)
-- =============================================
-- Provides production orders, multi-SKU order items, work orders,
-- operations, materials, and WIP metrics. Relies on helpers from 001.
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. PRODUCTION ORDERS & ITEMS
-- =============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'production_orders'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'purchase_orders'
    ) THEN
        EXECUTE 'ALTER TABLE production_orders RENAME TO purchase_orders';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'purchase_orders'
    ) THEN
        EXECUTE 'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'work_orders'
    ) THEN
        EXECUTE 'ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL';
        EXECUTE 'ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS target_quantity DECIMAL(15,3)';
        EXECUTE 'ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completed_quantity DECIMAL(15,3) DEFAULT 0';
        EXECUTE 'ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS rejected_quantity DECIMAL(15,3) DEFAULT 0';
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','PLANNED','RELEASED','IN_PROGRESS','COMPLETED','CANCELLED')),
    priority VARCHAR(20) DEFAULT 'MEDIUM'
        CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    customer_name VARCHAR(255),
    shift_number VARCHAR(50),
    production_stage VARCHAR(100),
    bom_id UUID REFERENCES boms(id) ON DELETE SET NULL,
    bom_version INTEGER,
    bom_snapshot JSONB,
    assigned_team VARCHAR(100),
    ocr_document_url TEXT,
    ocr_extracted_data JSONB,
    ocr_processed_at TIMESTAMPTZ,
    quantity_completed DECIMAL(15, 3) DEFAULT 0,
    quantity_in_fg DECIMAL(15, 3) DEFAULT 0,
    quantity_dispatched DECIMAL(15, 3) DEFAULT 0,
    quantity_reworked DECIMAL(15, 3) DEFAULT 0,
    quantity_scrapped DECIMAL(15, 3) DEFAULT 0,
    progress_percentage DECIMAL(5, 2) DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(15, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    completed_quantity DECIMAL(15, 3) DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 2. WORK ORDERS & SUPPORTING TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number VARCHAR(50) UNIQUE NOT NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    operation VARCHAR(100) NOT NULL,
    workstation VARCHAR(100),
    assigned_team VARCHAR(100),
    shift VARCHAR(20) CHECK (shift IN ('MORNING','AFTERNOON','NIGHT','CUSTOM')),
    target_quantity DECIMAL(15, 3) NOT NULL,
    completed_quantity DECIMAL(15, 3) DEFAULT 0,
    rejected_quantity DECIMAL(15, 3) DEFAULT 0,
    quantity_reworked DECIMAL(15, 3) DEFAULT 0,
    quantity_scrapped DECIMAL(15, 3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED'
        CHECK (status IN ('PLANNED','RELEASED','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED')),
    priority VARCHAR(20) DEFAULT 'MEDIUM'
        CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_order_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    required_quantity DECIMAL(15, 3) NOT NULL,
    allocated_quantity DECIMAL(15, 3) DEFAULT 0,
    issued_quantity DECIMAL(15, 3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','ALLOCATED','ISSUED','SHORTAGE')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_order_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    operation_type VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','SKIPPED')),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    operator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_order_quality_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    check_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','PASSED','FAILED','WAIVED')),
    checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    checked_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    required_qty DECIMAL(15, 3) NOT NULL,
    allocated_qty DECIMAL(15, 3) DEFAULT 0,
    issued_qty DECIMAL(15, 3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    availability_status VARCHAR(20) DEFAULT 'AVAILABLE'
        CHECK (availability_status IN ('AVAILABLE','PARTIAL','SHORTAGE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'order_team_assignments'
          AND column_name = 'production_order_id'
    ) THEN
        EXECUTE 'ALTER TABLE order_team_assignments RENAME COLUMN production_order_id TO purchase_order_id';
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS order_team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (purchase_order_id, user_id)
);

-- =============================================
-- 3. WIP METRICS
-- =============================================

CREATE TABLE IF NOT EXISTS wip_stage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_name VARCHAR(100) UNIQUE NOT NULL,
    stage_sequence INT NOT NULL,
    orders_count INT DEFAULT 0,
    units_count INT DEFAULT 0,
    avg_time_minutes DECIMAL(10, 2) DEFAULT 0,
    target_time_minutes DECIMAL(10, 2) NOT NULL,
    utilization_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (utilization_percentage BETWEEN 0 AND 100),
    health_status VARCHAR(20) DEFAULT 'healthy'
        CHECK (health_status IN ('healthy','warning','delayed')),
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stage_performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    orders_processed INT DEFAULT 0,
    units_processed INT DEFAULT 0,
    avg_time_minutes DECIMAL(10, 2) DEFAULT 0,
    utilization_percentage DECIMAL(5, 2) DEFAULT 0,
    efficiency_percentage DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (stage_name, date)
);

CREATE OR REPLACE FUNCTION update_wip_stage_metrics()
RETURNS VOID AS $$
BEGIN
    UPDATE wip_stage_metrics sm
    SET orders_count = COALESCE(agg.order_count, 0),
        units_count = COALESCE(agg.total_units, 0),
        avg_time_minutes = COALESCE(agg.avg_duration, 0),
        utilization_percentage = CASE
            WHEN sm.target_time_minutes > 0 THEN LEAST(100, COALESCE(agg.avg_duration, 0) / sm.target_time_minutes * 100)
            ELSE 0
        END,
        health_status = CASE
            WHEN COALESCE(agg.avg_duration, 0) <= sm.target_time_minutes THEN 'healthy'
            WHEN COALESCE(agg.avg_duration, 0) <= sm.target_time_minutes * 1.2 THEN 'warning'
            ELSE 'delayed'
        END,
        updated_at = NOW()
    FROM (
        SELECT
            operation AS stage_name,
            COUNT(*) AS order_count,
            SUM(target_quantity) AS total_units,
            AVG(EXTRACT(EPOCH FROM (COALESCE(actual_end, NOW()) - COALESCE(actual_start, scheduled_start))) / 60) AS avg_duration
        FROM work_orders
        WHERE status IN ('PLANNED','IN_PROGRESS','ON_HOLD')
        GROUP BY operation
    ) agg
    WHERE sm.stage_name = agg.stage_name;
END;
$$ LANGUAGE plpgsql;

INSERT INTO wip_stage_metrics (stage_name, stage_sequence, target_time_minutes)
VALUES
    ('Material Planning', 1, 30),
    ('Cutting', 2, 45),
    ('Sewing', 3, 120),
    ('Quality Check', 4, 20),
    ('Packaging', 5, 15)
ON CONFLICT (stage_name) DO NOTHING;

-- =============================================
-- 4. SEQUENCES, NUMBERING & TRIGGERS
-- =============================================

CREATE SEQUENCE IF NOT EXISTS purchase_order_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS work_order_seq START WITH 1;

CREATE OR REPLACE FUNCTION generate_sequential_number(
    p_prefix TEXT,
    p_sequence TEXT
)
RETURNS TEXT AS $$
DECLARE
    seq_val BIGINT;
    year_part TEXT := TO_CHAR(CURRENT_DATE, 'YY');
BEGIN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START WITH 1', p_sequence);
    EXECUTE format('SELECT nextval(''%I'')', p_sequence) INTO seq_val;
    RETURN format('%s-%s-%s', p_prefix, year_part, LPAD(seq_val::TEXT, 5, '0'));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_purchase_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(NEW.order_number, '') = '' THEN
        NEW.order_number := generate_sequential_number('PO', 'purchase_order_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_work_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(NEW.work_order_number, '') = '' THEN
        NEW.work_order_number := generate_sequential_number('WO', 'work_order_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    rec RECORD;
    timestamp_tables TEXT[] := ARRAY[
        'purchase_orders','purchase_order_items','work_orders','work_order_materials',
        'work_order_operations','work_order_quality_checks','order_materials','order_team_assignments'
    ];
BEGIN
    FOR rec IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.column_name = 'updated_at'
          AND c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.table_name = ANY(timestamp_tables)
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON %1$I;', rec.table_name);
        EXECUTE format('CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION update_timestamps();', rec.table_name);
    END LOOP;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_assign_purchase_order_number'
    ) THEN
        CREATE TRIGGER trg_assign_purchase_order_number
        BEFORE INSERT ON purchase_orders
        FOR EACH ROW EXECUTE FUNCTION assign_purchase_order_number();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_assign_work_order_number'
    ) THEN
        CREATE TRIGGER trg_assign_work_order_number
        BEFORE INSERT ON work_orders
        FOR EACH ROW EXECUTE FUNCTION assign_work_order_number();
    END IF;
END$$;

-- =============================================
-- 5. VIEWS
-- =============================================

CREATE OR REPLACE VIEW vw_purchase_order_status AS
SELECT
    po.id,
    po.order_number,
    po.status,
    po.priority,
    po.quantity,
    po.quantity_completed,
    po.unit,
    po.due_date,
    po.start_date,
    po.end_date,
    po.assigned_team,
    po.customer_name,
    po.production_stage,
    po.progress_percentage,
    p.code AS product_code,
    p.name AS product_name,
    po.created_at,
    po.updated_at
FROM purchase_orders po
LEFT JOIN products p ON p.id = po.product_id;

CREATE OR REPLACE VIEW vw_work_order_status AS
SELECT
    wo.id,
    wo.work_order_number,
    wo.status,
    wo.priority,
    wo.target_quantity,
    wo.completed_quantity,
    wo.rejected_quantity,
    wo.assigned_team,
    wo.operation,
    wo.shift,
    wo.scheduled_start,
    wo.scheduled_end,
    wo.actual_start,
    wo.actual_end,
    wo.created_at,
    wo.updated_at,
    po.order_number AS purchase_order_number,
    p.code AS product_code,
    p.name AS product_name
FROM work_orders wo
LEFT JOIN purchase_orders po ON po.id = wo.purchase_order_id
LEFT JOIN products p ON p.id = wo.product_id;

-- =============================================
-- 6. INDEXES (ensure_index_exists FROM 001)
-- =============================================

SELECT ensure_index_exists('purchase_orders', 'idx_purchase_orders_order_number', 'CREATE UNIQUE INDEX idx_purchase_orders_order_number ON purchase_orders(order_number);');
SELECT ensure_index_exists('purchase_orders', 'idx_purchase_orders_status', 'CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);');
SELECT ensure_index_exists('purchase_orders', 'idx_purchase_orders_due_date', 'CREATE INDEX idx_purchase_orders_due_date ON purchase_orders(due_date);');
SELECT ensure_index_exists('purchase_orders', 'idx_purchase_orders_product', 'CREATE INDEX idx_purchase_orders_product ON purchase_orders(product_id);');
SELECT ensure_index_exists('purchase_orders', 'idx_purchase_orders_assigned_team', 'CREATE INDEX idx_purchase_orders_assigned_team ON purchase_orders(assigned_team);');

SELECT ensure_index_exists('purchase_order_items', 'idx_purchase_order_items_order', 'CREATE INDEX idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);');
SELECT ensure_index_exists('purchase_order_items', 'idx_purchase_order_items_product', 'CREATE INDEX idx_purchase_order_items_product ON purchase_order_items(product_id);');

SELECT ensure_index_exists('work_orders', 'idx_work_orders_number', 'CREATE UNIQUE INDEX idx_work_orders_number ON work_orders(work_order_number);');
SELECT ensure_index_exists('work_orders', 'idx_work_orders_status', 'CREATE INDEX idx_work_orders_status ON work_orders(status);');
SELECT ensure_index_exists('work_orders', 'idx_work_orders_po', 'CREATE INDEX idx_work_orders_po ON work_orders(purchase_order_id);');
SELECT ensure_index_exists('work_orders', 'idx_work_orders_product', 'CREATE INDEX idx_work_orders_product ON work_orders(product_id);');

SELECT ensure_index_exists('work_order_materials', 'idx_wo_materials_work_order', 'CREATE INDEX idx_wo_materials_work_order ON work_order_materials(work_order_id);');
SELECT ensure_index_exists('work_order_materials', 'idx_wo_materials_product', 'CREATE INDEX idx_wo_materials_product ON work_order_materials(product_id);');

SELECT ensure_index_exists('work_order_operations', 'idx_wo_operations_work_order', 'CREATE INDEX idx_wo_operations_work_order ON work_order_operations(work_order_id);');
SELECT ensure_index_exists('work_order_operations', 'idx_wo_operations_operator', 'CREATE INDEX idx_wo_operations_operator ON work_order_operations(operator_id);');

SELECT ensure_index_exists('order_materials', 'idx_order_materials_order', 'CREATE INDEX idx_order_materials_order ON order_materials(purchase_order_id);');
SELECT ensure_index_exists('order_materials', 'idx_order_materials_status', 'CREATE INDEX idx_order_materials_status ON order_materials(availability_status);');

SELECT ensure_index_exists('order_team_assignments', 'idx_order_team_assignments_order', 'CREATE INDEX idx_order_team_assignments_order ON order_team_assignments(purchase_order_id);');

SELECT ensure_index_exists('wip_stage_metrics', 'idx_wip_stage_sequence', 'CREATE INDEX idx_wip_stage_sequence ON wip_stage_metrics(stage_sequence);');
SELECT ensure_index_exists('stage_performance_history', 'idx_stage_perf_stage_date', 'CREATE INDEX idx_stage_perf_stage_date ON stage_performance_history(stage_name, date);');

-- =============================================
-- 7. COMMENTS
-- =============================================

COMMENT ON TABLE purchase_orders IS 'Purchase order master including BOM linkage and OCR data';
COMMENT ON TABLE purchase_order_items IS 'Multi-SKU line items for purchase orders';
COMMENT ON TABLE work_orders IS 'Operational work orders tied to purchase orders';
COMMENT ON TABLE work_order_materials IS 'Material requirements per work order';
COMMENT ON TABLE work_order_operations IS 'Operations executed for each work order';
COMMENT ON TABLE work_order_quality_checks IS 'Quality checks for each work order';
COMMENT ON TABLE order_materials IS 'Material allocation requirements per purchase order';
COMMENT ON TABLE order_team_assignments IS 'Team member assignments for purchase orders';
COMMENT ON TABLE wip_stage_metrics IS 'Live WIP dashboard metrics';
COMMENT ON TABLE stage_performance_history IS 'Historical WIP stage performance';
COMMENT ON VIEW vw_purchase_order_status IS 'Purchase order status snapshot';
COMMENT ON VIEW vw_work_order_status IS 'Work order status snapshot';
