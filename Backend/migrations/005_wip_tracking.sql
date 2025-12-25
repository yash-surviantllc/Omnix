-- =============================================
-- WIP TRACKING SCHEMA
-- Tables for Work-in-Progress tracking and stage metrics
-- =============================================

-- =============================================
-- WORKING ORDERS TABLE
-- Individual work orders at workstation/operation level
-- =============================================
CREATE TABLE IF NOT EXISTS working_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_number VARCHAR(50) UNIQUE NOT NULL,
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    operation VARCHAR(100) NOT NULL,  -- Cutting, Sewing, Quality Check, etc.
    workstation VARCHAR(100),
    assigned_team VARCHAR(100),
    target_qty DECIMAL(15,3) NOT NULL CHECK (target_qty > 0),
    completed_qty DECIMAL(15,3) DEFAULT 0 CHECK (completed_qty >= 0),
    rejected_qty DECIMAL(15,3) DEFAULT 0 CHECK (rejected_qty >= 0),
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'On Hold', 'Cancelled')),
    priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_working_orders_number ON working_orders(work_order_number);
CREATE INDEX IF NOT EXISTS idx_working_orders_prod_order ON working_orders(production_order_id);
CREATE INDEX IF NOT EXISTS idx_working_orders_operation ON working_orders(operation);
CREATE INDEX IF NOT EXISTS idx_working_orders_status ON working_orders(status);
CREATE INDEX IF NOT EXISTS idx_working_orders_workstation ON working_orders(workstation);

-- =============================================
-- WIP STAGE METRICS TABLE
-- Real-time metrics for each production stage
-- =============================================
CREATE TABLE IF NOT EXISTS wip_stage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_name VARCHAR(100) UNIQUE NOT NULL,  -- Material Planning, Cutting, Sewing, etc.
    stage_sequence INT NOT NULL,  -- Order of stages
    orders_count INT DEFAULT 0,
    units_count INT DEFAULT 0,
    avg_time_minutes DECIMAL(10,2) DEFAULT 0,
    target_time_minutes DECIMAL(10,2) NOT NULL,
    utilization_percentage DECIMAL(5,2) DEFAULT 0 CHECK (utilization_percentage >= 0 AND utilization_percentage <= 100),
    health_status VARCHAR(20) DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'warning', 'delayed')),
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wip_stage_metrics_stage ON wip_stage_metrics(stage_name);
CREATE INDEX IF NOT EXISTS idx_wip_stage_metrics_health ON wip_stage_metrics(health_status);
CREATE INDEX IF NOT EXISTS idx_wip_stage_metrics_sequence ON wip_stage_metrics(stage_sequence);

-- =============================================
-- STAGE PERFORMANCE HISTORY TABLE
-- Historical tracking of stage performance
-- =============================================
CREATE TABLE IF NOT EXISTS stage_performance_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    orders_processed INT DEFAULT 0,
    units_processed INT DEFAULT 0,
    avg_time_minutes DECIMAL(10,2) DEFAULT 0,
    utilization_percentage DECIMAL(5,2) DEFAULT 0,
    efficiency_percentage DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stage_name, date)
);

CREATE INDEX IF NOT EXISTS idx_stage_perf_stage_date ON stage_performance_history(stage_name, date);

-- =============================================
-- TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS update_working_orders_updated_at ON working_orders;
CREATE TRIGGER update_working_orders_updated_at BEFORE UPDATE ON working_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wip_stage_metrics_updated_at ON wip_stage_metrics;
CREATE TRIGGER update_wip_stage_metrics_updated_at BEFORE UPDATE ON wip_stage_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- WORKING ORDER NUMBER SEQUENCE
-- =============================================
CREATE SEQUENCE IF NOT EXISTS working_order_seq START WITH 1;

-- =============================================
-- SAMPLE DATA - WIP STAGE METRICS
-- =============================================
INSERT INTO wip_stage_metrics (stage_name, stage_sequence, target_time_minutes, orders_count, units_count, avg_time_minutes, utilization_percentage, health_status)
VALUES 
    ('Material Planning', 1, 30, 3, 450, 25, 75, 'healthy'),
    ('Cutting', 2, 45, 5, 800, 50, 85, 'warning'),
    ('Sewing', 3, 120, 8, 1200, 135, 95, 'delayed'),
    ('Quality Check', 4, 20, 4, 600, 18, 65, 'healthy'),
    ('Packaging', 5, 15, 2, 300, 12, 55, 'healthy'),
    ('Dispatch', 6, 10, 1, 150, 8, 40, 'healthy')
ON CONFLICT (stage_name) DO UPDATE SET
    orders_count = EXCLUDED.orders_count,
    units_count = EXCLUDED.units_count,
    avg_time_minutes = EXCLUDED.avg_time_minutes,
    utilization_percentage = EXCLUDED.utilization_percentage,
    health_status = EXCLUDED.health_status,
    updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- SAMPLE DATA - WORKING ORDERS
-- =============================================
DO $$
DECLARE
    v_prod_order_id UUID;
    v_user_id UUID;
BEGIN
    -- Get first production order
    SELECT id INTO v_prod_order_id FROM production_orders WHERE status = 'In Progress' LIMIT 1;
    
    -- Get first user
    SELECT id INTO v_user_id FROM users LIMIT 1;
    
    IF v_prod_order_id IS NOT NULL THEN
        INSERT INTO working_orders (
            work_order_number, production_order_id, operation, workstation, 
            assigned_team, target_qty, completed_qty, unit, status, priority,
            scheduled_start, scheduled_end, created_by
        )
        VALUES 
            ('WO-2024-0001', v_prod_order_id, 'Cutting', 'Workstation A1', 'Team A - Cutting Department', 100, 75, 'pcs', 'In Progress', 'High', CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP + INTERVAL '1 hour', v_user_id),
            ('WO-2024-0002', v_prod_order_id, 'Sewing', 'Workstation B2', 'Team B - Sewing Department', 100, 45, 'pcs', 'In Progress', 'High', CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '3 hours', v_user_id),
            ('WO-2024-0003', v_prod_order_id, 'Quality Check', 'QC Station 1', 'Team C - Quality Control', 100, 0, 'pcs', 'Pending', 'Normal', CURRENT_TIMESTAMP + INTERVAL '3 hours', CURRENT_TIMESTAMP + INTERVAL '5 hours', v_user_id)
        ON CONFLICT (work_order_number) DO NOTHING;
    END IF;
END $$;

-- =============================================
-- FUNCTION TO UPDATE WIP METRICS
-- Call this periodically or via trigger to recalculate metrics
-- =============================================
CREATE OR REPLACE FUNCTION update_wip_stage_metrics()
RETURNS void AS $$
BEGIN
    -- Update metrics based on current working orders
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
        updated_at = CURRENT_TIMESTAMP
    FROM (
        SELECT 
            operation,
            COUNT(DISTINCT production_order_id) as order_count,
            SUM(target_qty) as total_units,
            AVG(EXTRACT(EPOCH FROM (COALESCE(actual_end, CURRENT_TIMESTAMP) - COALESCE(actual_start, scheduled_start))) / 60) as avg_duration
        FROM working_orders
        WHERE status IN ('In Progress', 'Pending')
        GROUP BY operation
    ) wo_stats
    WHERE sm.stage_name = wo_stats.operation;
END;
$$ LANGUAGE plpgsql;
