-- =============================================
-- WORK ORDERS CONSOLIDATED MIGRATION
-- Combines all work order related migrations
-- =============================================

SET search_path TO public;

-- =============================================
-- WORKSTATIONS TABLE
-- =============================================

-- Create workstations table if it doesn't exist
CREATE TABLE IF NOT EXISTS workstations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    location_id UUID REFERENCES locations(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on the code field for faster lookups
CREATE INDEX IF NOT EXISTS idx_workstations_code ON workstations(code);

-- =============================================
-- WORK ORDERS TABLE (PO-Based)
-- =============================================

-- Create work_orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number VARCHAR(50) UNIQUE NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    target_qty DECIMAL(15,3) NOT NULL CHECK (target_qty > 0),
    unit VARCHAR(20) NOT NULL,
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status VARCHAR(20) DEFAULT 'Planned' CHECK (status IN ('Planned', 'Released', 'In Progress', 'On Hold', 'Completed', 'Cancelled')),
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    operation VARCHAR(100) NOT NULL,
    workstation_id UUID REFERENCES workstations(id) ON DELETE SET NULL,
    workstation_name VARCHAR(100), -- Denormalized for performance
    assigned_team VARCHAR(100),
    shift VARCHAR(20) CHECK (shift IN ('Morning', 'Afternoon', 'Night', 'Custom')),
    completed_qty DECIMAL(15,3) DEFAULT 0,
    rejected_qty DECIMAL(15,3) DEFAULT 0,
    quantity_completed DECIMAL(15,3) DEFAULT 0,
    quantity_reworked DECIMAL(15,3) DEFAULT 0,
    quantity_scrapped DECIMAL(15,3) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Align legacy schemas that used a single workstation text column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'work_orders'
          AND column_name = 'workstation'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'work_orders'
          AND column_name = 'workstation_name'
    ) THEN
        EXECUTE 'ALTER TABLE work_orders RENAME COLUMN workstation TO workstation_name';
    END IF;
END $$;

ALTER TABLE work_orders
    ADD COLUMN IF NOT EXISTS workstation_id UUID REFERENCES workstations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS workstation_name VARCHAR(100);

-- Add indexes for work_orders
CREATE INDEX IF NOT EXISTS idx_work_orders_po_id ON work_orders(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_product_id ON work_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_number ON work_orders(work_order_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_start ON work_orders(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_work_orders_shift ON work_orders(shift) WHERE shift IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_workstation_id ON work_orders(workstation_id) WHERE workstation_id IS NOT NULL;

-- Work order materials (calculated from BOM)
CREATE TABLE IF NOT EXISTS work_order_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES products(id),
    required_qty DECIMAL(15,3) NOT NULL,
    allocated_qty DECIMAL(15,3) DEFAULT 0,
    issued_qty DECIMAL(15,3) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Allocated', 'Issued', 'Shortage')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for work_order_materials
CREATE INDEX IF NOT EXISTS idx_work_order_materials_wo_id ON work_order_materials(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_materials_material_id ON work_order_materials(material_id);

-- Work order operations
CREATE TABLE IF NOT EXISTS work_order_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    operation_name VARCHAR(100) NOT NULL,
    sequence_number INTEGER NOT NULL,
    workstation_id UUID REFERENCES workstations(id) ON DELETE SET NULL,
    workstation_name VARCHAR(100), -- Denormalized for performance
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Skipped')),
    planned_start TIMESTAMP,
    planned_end TIMESTAMP,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_work_order_operation_sequence UNIQUE (work_order_id, sequence_number)
);

-- Align legacy schemas that used a single workstation text column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'work_order_operations'
          AND column_name = 'workstation'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'work_order_operations'
          AND column_name = 'workstation_name'
    ) THEN
        EXECUTE 'ALTER TABLE work_order_operations RENAME COLUMN workstation TO workstation_name';
    END IF;
END $$;

ALTER TABLE work_order_operations
    ADD COLUMN IF NOT EXISTS workstation_id UUID REFERENCES workstations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS workstation_name VARCHAR(100);

ALTER TABLE work_order_operations
    ADD COLUMN IF NOT EXISTS planned_start TIMESTAMP,
    ADD COLUMN IF NOT EXISTS planned_end TIMESTAMP,
    ADD COLUMN IF NOT EXISTS actual_start TIMESTAMP,
    ADD COLUMN IF NOT EXISTS actual_end TIMESTAMP;

-- Add indexes for work_order_operations
CREATE INDEX IF NOT EXISTS idx_work_order_operations_wo_id ON work_order_operations(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_operations_status ON work_order_operations(status);
CREATE INDEX IF NOT EXISTS idx_work_order_operations_workstation_id ON work_order_operations(workstation_id) WHERE workstation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_order_operations_dates ON work_order_operations(planned_start, planned_end, actual_start, actual_end);

-- =============================================
-- SEQUENCES
-- =============================================

-- Work order number sequence
CREATE SEQUENCE IF NOT EXISTS work_order_seq START WITH 1;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to generate work order number
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS TRIGGER AS $$
DECLARE
    next_val INTEGER;
    po_prefix VARCHAR(10);
BEGIN
    -- Get the next value from the sequence
    SELECT nextval('work_order_seq'::regclass) INTO next_val;
    
    -- Get PO prefix if purchase_order_id is available
    IF NEW.purchase_order_id IS NOT NULL THEN
        SELECT SUBSTRING(order_number, 1, 3) INTO po_prefix
        FROM purchase_orders
        WHERE id = NEW.purchase_order_id;
    END IF;
    
    -- Format: WO-{PREFIX}-{YEAR}{MONTH}-{SEQUENCE}
    NEW.work_order_number := CONCAT(
        'WO-',
        COALESCE(po_prefix, 'GEN'),
        '-',
        TO_CHAR(CURRENT_DATE, 'YYMM'),
        '-',
        LPAD(next_val::TEXT, 4, '0')
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to allocate stock for work order
CREATE OR REPLACE FUNCTION allocate_stock_for_work_order(p_work_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_bom_id UUID;
    v_production_qty NUMERIC;
    v_material RECORD;
    v_required_qty NUMERIC;
    v_available_qty NUMERIC;
    v_allocated NUMERIC;
BEGIN
    -- Get BOM ID and target quantity from work order
    SELECT bom_id, target_qty INTO v_bom_id, v_production_qty
    FROM work_orders
    WHERE id = p_work_order_id;
    
    -- If no BOM ID, return false
    IF v_bom_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Loop through BOM materials and allocate stock
    FOR v_material IN 
        SELECT bm.material_id, bm.quantity as qty_per_unit, bm.unit
        FROM bom_materials bm
        WHERE bm.bom_id = v_bom_id
    LOOP
        -- Calculate required quantity
        v_required_qty := v_material.qty_per_unit * v_production_qty;
        
        -- Check available quantity
        SELECT COALESCE(SUM(available_qty), 0) INTO v_available_qty
        FROM inventory
        WHERE product_id = v_material.material_id;
        
        -- Calculate how much we can allocate
        v_allocated := LEAST(v_required_qty, v_available_qty);
        
        -- Insert or update work order material
        INSERT INTO work_order_materials (
            work_order_id,
            material_id,
            required_qty,
            allocated_qty,
            unit,
            status
        ) VALUES (
            p_work_order_id,
            v_material.material_id,
            v_required_qty,
            v_allocated,
            v_material.unit,
            CASE WHEN v_allocated >= v_required_qty THEN 'Allocated' ELSE 'Shortage' END
        )
        ON CONFLICT (work_order_id, material_id)
        DO UPDATE SET
            required_qty = EXCLUDED.required_qty,
            allocated_qty = EXCLUDED.allocated_qty,
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_work_order_number'
          AND tgrelid = 'work_orders'::regclass
    ) THEN
        DROP TRIGGER trg_work_order_number ON work_orders;
    END IF;

    CREATE TRIGGER trg_work_order_number
    BEFORE INSERT ON work_orders
    FOR EACH ROW
    WHEN (NEW.work_order_number IS NULL)
    EXECUTE FUNCTION generate_work_order_number();
END $$;

-- Trigger to update updated_at timestamp (safe re-creation)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_work_orders_updated_at'
          AND tgrelid = 'work_orders'::regclass
    ) THEN
        DROP TRIGGER update_work_orders_updated_at ON work_orders;
    END IF;

    CREATE TRIGGER update_work_orders_updated_at
    BEFORE UPDATE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamps();
END $$;

-- =============================================
-- DATA MIGRATION (if needed)
-- =============================================

-- If working_orders table exists (from previous migrations), migrate data to work_orders
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'working_orders') THEN
        -- Migrate data from working_orders to work_orders
        INSERT INTO work_orders (
            id,
            purchase_order_id,
            product_id,
            target_qty,
            unit,
            priority,
            status,
            scheduled_start,
            scheduled_end,
            actual_start,
            actual_end,
            operation,
            workstation_id,
            workstation_name,
            assigned_team,
            completed_qty,
            rejected_qty,
            notes,
            created_by,
            updated_by,
            created_at,
            updated_at
        )
        SELECT 
            id,
            purchase_order_id,
            product_id,
            target_qty,
            unit,
            priority,
            status,
            scheduled_start,
            scheduled_end,
            actual_start,
            actual_end,
            operation,
            workstation_id,
            workstation_name,
            assigned_team,
            completed_qty,
            rejected_qty,
            notes,
            created_by,
            updated_by,
            created_at,
            updated_at
        FROM working_orders
        WHERE id NOT IN (SELECT id FROM work_orders);
        
        -- Update any work_orders that might be missing product_id
        UPDATE work_orders wo
        SET product_id = po.product_id
        FROM purchase_orders po
        WHERE wo.purchase_order_id = po.id
        AND wo.product_id IS NULL;
        
        -- Migrate work_order_materials if they exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'working_order_materials') THEN
            INSERT INTO work_order_materials (
                id,
                work_order_id,
                material_id,
                required_qty,
                allocated_qty,
                issued_qty,
                unit,
                status,
                created_at,
                updated_at
            )
            SELECT 
                id,
                working_order_id,
                material_id,
                required_qty,
                allocated_qty,
                issued_qty,
                unit,
                status,
                created_at,
                updated_at
            FROM working_order_materials
            WHERE working_order_id NOT IN (SELECT id FROM work_orders);
        END IF;
        
        -- Migrate work_order_operations if they exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'working_order_operations') THEN
            INSERT INTO work_order_operations (
                id,
                work_order_id,
                operation_name,
                sequence_number,
                workstation_id,
                workstation_name,
                status,
                planned_start,
                planned_end,
                actual_start,
                actual_end,
                notes,
                created_at,
                updated_at
            )
            SELECT 
                id,
                working_order_id,
                operation_name,
                sequence_number,
                workstation_id,
                workstation_name,
                status,
                planned_start,
                planned_end,
                actual_start,
                actual_end,
                notes,
                created_at,
                updated_at
            FROM working_order_operations
            WHERE working_order_id NOT IN (SELECT id FROM work_orders);
        END IF;
    END IF;
END $$;

-- =============================================
-- FINAL CHECKS
-- =============================================

-- Ensure all work_orders have a work_order_number
UPDATE work_orders 
SET work_order_number = CONCAT('WO-', id::TEXT)
WHERE work_order_number IS NULL;

-- Ensure all work_orders have a status
UPDATE work_orders 
SET status = 'Pending'
WHERE status IS NULL;

-- Ensure all work_order_materials have a status
UPDATE work_order_materials 
SET status = 'Pending'
WHERE status IS NULL;

-- =============================================
-- DATA MIGRATION FOR EXISTING RECORDS
-- =============================================

-- Create a default workstation for existing records if none exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM workstations WHERE code = 'DEFAULT') THEN
        INSERT INTO workstations (id, code, name, is_active)
        VALUES (
            '00000000-0000-0000-0000-000000000001'::uuid,
            'DEFAULT',
            'Default Workstation',
            true
        );
    END IF;
END $$;

-- Update existing work_orders to use the default workstation
UPDATE work_orders
SET 
    workstation_id = (SELECT id FROM workstations WHERE code = 'DEFAULT'),
    workstation_name = 'Default Workstation'
WHERE workstation_id IS NULL;

-- Update work_order_operations to use the default workstation
UPDATE work_order_operations
SET 
    workstation_id = (SELECT id FROM workstations WHERE code = 'DEFAULT'),
    workstation_name = 'Default Workstation'
WHERE workstation_id IS NULL;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify workstations were created
SELECT 'WORKSTATIONS' AS table_name, COUNT(*) AS record_count FROM workstations
UNION ALL
-- Verify work_orders have workstations
SELECT 'WORK_ORDERS', COUNT(*) FROM work_orders WHERE workstation_id IS NOT NULL
UNION ALL
-- Verify work_order_operations have workstations
SELECT 'WORK_ORDER_OPS', COUNT(*) FROM work_order_operations WHERE workstation_id IS NOT NULL;

-- =============================================
-- WIP STAGE MASTER / TRACKING CONSOLIDATION
-- =============================================

CREATE TABLE IF NOT EXISTS wip_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    sequence_number INTEGER NOT NULL UNIQUE,
    target_avg_time_minutes NUMERIC(10,2) NOT NULL DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    location_id UUID REFERENCES locations(id),
    color VARCHAR(20) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_wip_stages_code ON wip_stages(code);
CREATE INDEX IF NOT EXISTS idx_wip_stages_sequence ON wip_stages(sequence_number);

CREATE TABLE IF NOT EXISTS order_stage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES purchase_orders(id),
    current_stage_id UUID NOT NULL REFERENCES wip_stages(id),
    quantity_in_stage NUMERIC(15,3) NOT NULL DEFAULT 0,
    entered_stage_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_id, current_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_order_stage_tracking_stage ON order_stage_tracking(current_stage_id);

CREATE TABLE IF NOT EXISTS wip_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID NOT NULL REFERENCES purchase_orders(id),
    from_stage_id UUID REFERENCES wip_stages(id),
    to_stage_id UUID NOT NULL REFERENCES wip_stages(id),
    quantity NUMERIC(15,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Completed',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    actual_time_minutes NUMERIC(10,2),
    notes TEXT,
    transferred_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wip_transfers_order ON wip_transfers(order_id);
CREATE INDEX IF NOT EXISTS idx_wip_transfers_to_stage ON wip_transfers(to_stage_id);
CREATE INDEX IF NOT EXISTS idx_wip_transfers_created ON wip_transfers(created_at DESC);

INSERT INTO wip_stages (name, code, sequence_number, target_avg_time_minutes, color)
VALUES
    ('Material Planning', 'PLANNING', 1, 30, '#6366F1'),
    ('Cutting', 'CUTTING', 2, 45, '#8B5CF6'),
    ('Sewing', 'SEWING', 3, 120, '#EC4899'),
    ('Quality Check', 'QC', 4, 20, '#10B981'),
    ('Packaging', 'PACKAGING', 5, 15, '#F59E0B'),
    ('Dispatch', 'DISPATCH', 6, 10, '#3B82F6')
ON CONFLICT (code) DO NOTHING;

DROP TRIGGER IF EXISTS update_wip_stages_updated_at ON wip_stages;
CREATE TRIGGER update_wip_stages_updated_at
    BEFORE UPDATE ON wip_stages
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

DROP TRIGGER IF EXISTS update_wip_transfers_updated_at ON wip_transfers;
CREATE TRIGGER update_wip_transfers_updated_at
    BEFORE UPDATE ON wip_transfers
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

DROP TRIGGER IF EXISTS update_order_stage_tracking_updated_at ON order_stage_tracking;
CREATE TRIGGER update_order_stage_tracking_updated_at
    BEFORE UPDATE ON order_stage_tracking
    FOR EACH ROW EXECUTE FUNCTION update_timestamps();

CREATE SEQUENCE IF NOT EXISTS wip_transfer_seq START WITH 1;
