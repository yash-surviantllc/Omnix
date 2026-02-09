-- =============================================
-- 007: MATERIAL REQUISITIONS
-- Complete material requisition system with auto-numbering
-- =============================================

SET search_path TO public;

-- 1. MATERIAL REQUISITIONS TABLE
CREATE TABLE IF NOT EXISTS material_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_number VARCHAR(20) UNIQUE NOT NULL,
    work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
    work_order_number VARCHAR(50),
    department VARCHAR(100) NOT NULL,
    requesting_stage VARCHAR(100),
    requested_by VARCHAR(200) NOT NULL,
    reviewed_by VARCHAR(200),
    shift VARCHAR(50),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    delivery_instructions TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 2. MATERIAL REQUISITION ITEMS TABLE
CREATE TABLE IF NOT EXISTS material_requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES material_requisitions(id) ON DELETE CASCADE,
    rm_code VARCHAR(100) NOT NULL,
    material_description TEXT NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    quantity_requested NUMERIC(15,3) NOT NULL,
    required_date DATE,
    location VARCHAR(200),
    priority VARCHAR(50) DEFAULT 'Normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_quantity_positive CHECK (quantity_requested > 0)
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_material_requisitions_number ON material_requisitions(requisition_number);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_wo ON material_requisitions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_department ON material_requisitions(department);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_status ON material_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_material_requisitions_created ON material_requisitions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_requisition_items_req ON material_requisition_items(requisition_id);

-- 4. AUTO-INCREMENT SEQUENCE FOR REQUISITION NUMBERS
-- Reset sequence each year
CREATE SEQUENCE IF NOT EXISTS material_requisition_seq START 1;

-- 5. FUNCTION TO GENERATE REQUISITION NUMBER
-- Format: MR-YYYY-NNNN (e.g., MR-2026-0001)
CREATE OR REPLACE FUNCTION generate_requisition_number()
RETURNS VARCHAR AS $$
DECLARE
    year_part VARCHAR(4);
    seq_part VARCHAR(4);
    new_number VARCHAR(20);
    current_year INTEGER;
    last_year INTEGER;
BEGIN
    -- Get current year
    current_year := EXTRACT(YEAR FROM NOW());
    
    -- Check if we need to reset sequence for new year
    -- Get the year from the last requisition number
    SELECT EXTRACT(YEAR FROM created_at)::INTEGER INTO last_year
    FROM material_requisitions
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Reset sequence if year changed
    IF last_year IS NOT NULL AND last_year < current_year THEN
        ALTER SEQUENCE material_requisition_seq RESTART WITH 1;
    END IF;
    
    -- Generate number
    year_part := TO_CHAR(NOW(), 'YYYY');
    seq_part := LPAD(nextval('material_requisition_seq')::TEXT, 4, '0');
    new_number := 'MR-' || year_part || '-' || seq_part;
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 6. TRIGGER TO AUTO-GENERATE REQUISITION NUMBER
CREATE OR REPLACE FUNCTION set_requisition_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.requisition_number IS NULL OR NEW.requisition_number = '' THEN
        NEW.requisition_number := generate_requisition_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_requisition_number ON material_requisitions;
CREATE TRIGGER trg_set_requisition_number
    BEFORE INSERT ON material_requisitions
    FOR EACH ROW
    EXECUTE FUNCTION set_requisition_number();

-- 7. AUTO-UPDATE TIMESTAMPS
CREATE OR REPLACE FUNCTION update_material_requisition_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_material_requisition_timestamp ON material_requisitions;
CREATE TRIGGER trg_material_requisition_timestamp
    BEFORE UPDATE ON material_requisitions
    FOR EACH ROW
    EXECUTE FUNCTION update_material_requisition_timestamp();

-- 8. HELPER VIEW FOR REQUISITIONS WITH ITEM COUNT
CREATE OR REPLACE VIEW vw_material_requisitions_summary AS
SELECT 
    mr.id,
    mr.requisition_number,
    mr.work_order_number,
    mr.department,
    mr.requesting_stage,
    mr.requested_by,
    mr.reviewed_by,
    mr.shift,
    mr.status,
    mr.created_at,
    COUNT(mri.id) as item_count,
    SUM(mri.quantity_requested) as total_quantity
FROM material_requisitions mr
LEFT JOIN material_requisition_items mri ON mri.requisition_id = mr.id
GROUP BY mr.id, mr.requisition_number, mr.work_order_number, mr.department, 
         mr.requesting_stage, mr.requested_by, mr.reviewed_by, mr.shift, 
         mr.status, mr.created_at;

-- 9. GRANT PERMISSIONS (if using RLS)
-- GRANT SELECT, INSERT, UPDATE ON material_requisitions TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON material_requisition_items TO authenticated;
-- GRANT SELECT ON vw_material_requisitions_summary TO authenticated;

-- 10. COMMENTS
COMMENT ON TABLE material_requisitions IS 'Material requisition requests with auto-generated unique numbers';
COMMENT ON TABLE material_requisition_items IS 'Line items for material requisitions';
COMMENT ON COLUMN material_requisitions.requisition_number IS 'Auto-generated unique number in format MR-YYYY-NNNN';
COMMENT ON COLUMN material_requisition_items.rm_code IS 'Raw Material code/number';
COMMENT ON FUNCTION generate_requisition_number() IS 'Generates unique requisition numbers in format MR-YYYY-NNNN, resets sequence each year';
COMMENT ON VIEW vw_material_requisitions_summary IS 'Summary view of requisitions with item counts';

-- 11. VERIFICATION QUERIES (commented out)
-- SELECT * FROM material_requisitions ORDER BY created_at DESC LIMIT 10;
-- SELECT * FROM vw_material_requisitions_summary ORDER BY created_at DESC;
-- SELECT generate_requisition_number(); -- Test number generation