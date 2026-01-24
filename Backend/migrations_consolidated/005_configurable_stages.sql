-- =============================================
-- 005: CONFIGURABLE WIP STAGES
-- Enables product-specific stage configuration
-- =============================================

SET search_path TO public;

-- 1. PRODUCT-SPECIFIC STAGE ASSIGNMENTS
-- This table maps which stages apply to which products
CREATE TABLE IF NOT EXISTS product_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES wip_stages(id) ON DELETE RESTRICT,
    sequence_number INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    estimated_time_minutes NUMERIC(10,2), -- Product-specific override for target time
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_product_stage UNIQUE(product_id, stage_id),
    CONSTRAINT uq_product_sequence UNIQUE(product_id, sequence_number),
    CONSTRAINT chk_sequence_positive CHECK (sequence_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_product_stages_product ON product_stages(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stages_stage ON product_stages(stage_id);
CREATE INDEX IF NOT EXISTS idx_product_stages_sequence ON product_stages(product_id, sequence_number);

-- 2. ADD METADATA TO WIP_STAGES
-- Add description and icon fields for better UI representation
ALTER TABLE wip_stages 
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS icon VARCHAR(50);

-- 3. STAGE USAGE TRACKING
-- Function to check if a stage is in use (for safe deletion)
CREATE OR REPLACE FUNCTION is_stage_in_use(p_stage_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check if stage is assigned to any products
    SELECT COUNT(*) INTO v_count
    FROM product_stages
    WHERE stage_id = p_stage_id;
    
    IF v_count > 0 THEN
        RETURN TRUE;
    END IF;
    
    -- Check if stage is used in any active work orders
    SELECT COUNT(*) INTO v_count
    FROM work_orders wo
    JOIN wip_stages ws ON ws.name = wo.operation
    WHERE ws.id = p_stage_id
    AND wo.status NOT IN ('Cancelled', 'Completed');
    
    IF v_count > 0 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 4. GET STAGES FOR A PRODUCT
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
            ws.id,
            ws.name,
            ws.code,
            ps.sequence_number,
            COALESCE(ps.estimated_time_minutes, ws.target_avg_time_minutes) as target_avg_time_minutes,
            ws.color,
            ws.icon,
            ws.description,
            ps.is_required,
            ws.is_active
        FROM product_stages ps
        JOIN wip_stages ws ON ws.id = ps.stage_id
        WHERE ps.product_id = p_product_id
        AND ws.is_active = TRUE
        ORDER BY ps.sequence_number;
    ELSE
        -- Return default active stages
        RETURN QUERY
        SELECT 
            ws.id,
            ws.name,
            ws.code,
            ws.sequence_number,
            ws.target_avg_time_minutes,
            ws.color,
            ws.icon,
            ws.description,
            TRUE as is_required,
            ws.is_active
        FROM wip_stages ws
        WHERE ws.is_active = TRUE
        ORDER BY ws.sequence_number;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. SAFE STAGE DELETION
-- Trigger to prevent hard deletion of stages in use
CREATE OR REPLACE FUNCTION prevent_stage_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF is_stage_in_use(OLD.id) THEN
        RAISE EXCEPTION 'Cannot delete stage "%" as it is currently assigned to products or used in active work orders. Please deactivate it instead.', OLD.name;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_stage_deletion ON wip_stages;
CREATE TRIGGER trg_prevent_stage_deletion
    BEFORE DELETE ON wip_stages
    FOR EACH ROW
    EXECUTE FUNCTION prevent_stage_deletion();

-- 6. AUTO-UPDATE TIMESTAMPS
CREATE OR REPLACE FUNCTION update_product_stages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_stages_timestamp ON product_stages;
CREATE TRIGGER trg_product_stages_timestamp
    BEFORE UPDATE ON product_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stages_timestamp();

-- 7. VALIDATE STAGE SEQUENCE
-- Ensure sequence numbers are contiguous (1, 2, 3, ...) for each product
CREATE OR REPLACE FUNCTION validate_stage_sequence()
RETURNS TRIGGER AS $$
DECLARE
    v_max_seq INTEGER;
    v_count INTEGER;
BEGIN
    -- Get max sequence for this product
    SELECT MAX(sequence_number), COUNT(*)
    INTO v_max_seq, v_count
    FROM product_stages
    WHERE product_id = NEW.product_id;
    
    -- If this is an insert and sequence is not contiguous, reject
    IF TG_OP = 'INSERT' THEN
        IF NEW.sequence_number > (COALESCE(v_count, 0) + 1) THEN
            RAISE EXCEPTION 'Sequence number must be contiguous. Expected % or less, got %', 
                COALESCE(v_count, 0) + 1, NEW.sequence_number;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_stage_sequence ON product_stages;
CREATE TRIGGER trg_validate_stage_sequence
    BEFORE INSERT OR UPDATE ON product_stages
    FOR EACH ROW
    EXECUTE FUNCTION validate_stage_sequence();

-- 8. UPDATE EXISTING WIP_STAGES WITH ICONS AND DESCRIPTIONS
UPDATE wip_stages SET 
    icon = CASE code
        WHEN 'PLANNING' THEN 'ClipboardList'
        WHEN 'CUTTING' THEN 'Scissors'
        WHEN 'SEWING' THEN 'Shirt'
        WHEN 'QC' THEN 'CheckCircle'
        WHEN 'PACKAGING' THEN 'Package'
        WHEN 'DISPATCH' THEN 'Truck'
        ELSE NULL
    END,
    description = CASE code
        WHEN 'PLANNING' THEN 'Material planning and preparation'
        WHEN 'CUTTING' THEN 'Fabric cutting and pattern preparation'
        WHEN 'SEWING' THEN 'Sewing and assembly operations'
        WHEN 'QC' THEN 'Quality control and inspection'
        WHEN 'PACKAGING' THEN 'Final packaging and labeling'
        WHEN 'DISPATCH' THEN 'Ready for dispatch'
        ELSE NULL
    END
WHERE icon IS NULL OR description IS NULL;

-- 9. CREATE VIEW FOR STAGE USAGE STATISTICS
CREATE OR REPLACE VIEW vw_stage_usage AS
SELECT 
    ws.id,
    ws.name,
    ws.code,
    ws.sequence_number,
    ws.is_active,
    COUNT(DISTINCT ps.product_id) as products_using_stage,
    COUNT(DISTINCT wo.id) as active_work_orders,
    is_stage_in_use(ws.id) as is_in_use
FROM wip_stages ws
LEFT JOIN product_stages ps ON ps.stage_id = ws.id
LEFT JOIN work_orders wo ON wo.operation = ws.name 
    AND wo.status NOT IN ('Cancelled', 'Completed')
GROUP BY ws.id, ws.name, ws.code, ws.sequence_number, ws.is_active;

-- 10. GRANT PERMISSIONS (if using RLS)
-- GRANT SELECT, INSERT, UPDATE ON product_stages TO authenticated;
-- GRANT SELECT ON vw_stage_usage TO authenticated;

COMMENT ON TABLE product_stages IS 'Maps which WIP stages apply to which products, allowing product-specific production workflows';
COMMENT ON FUNCTION get_product_stages(UUID) IS 'Returns stages for a product. If product has custom stages, returns those; otherwise returns default active stages';
COMMENT ON FUNCTION is_stage_in_use(UUID) IS 'Checks if a stage is currently assigned to products or used in active work orders';
COMMENT ON VIEW vw_stage_usage IS 'Shows usage statistics for each stage including product assignments and active work orders';
