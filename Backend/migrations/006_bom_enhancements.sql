-- =============================================
-- BOM ENHANCEMENTS MIGRATION
-- Adds missing features: BOM version tracking in production orders
-- and multi-level BOM support (sub-assemblies)
-- =============================================

-- =============================================
-- STEP 1: ADD BOM VERSION TRACKING TO PRODUCTION ORDERS
-- =============================================

-- Add BOM version and snapshot columns to production_orders
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS bom_id UUID REFERENCES boms(id),
ADD COLUMN IF NOT EXISTS bom_version INTEGER,
ADD COLUMN IF NOT EXISTS bom_snapshot JSONB;

-- Create index for BOM tracking
CREATE INDEX IF NOT EXISTS idx_prod_orders_bom_id ON production_orders(bom_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_bom_version ON production_orders(bom_version);

-- Add comment
COMMENT ON COLUMN production_orders.bom_id IS 'Reference to the BOM used for this order';
COMMENT ON COLUMN production_orders.bom_version IS 'Version of the BOM at the time of order creation';
COMMENT ON COLUMN production_orders.bom_snapshot IS 'Full snapshot of BOM materials at order creation time';

-- =============================================
-- STEP 2: ADD MULTI-LEVEL BOM SUPPORT (SUB-ASSEMBLIES)
-- =============================================

-- Add sub-assembly support to bom_materials table
ALTER TABLE bom_materials
ADD COLUMN IF NOT EXISTS is_sub_assembly BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sub_assembly_bom_id UUID REFERENCES boms(id),
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 0;

-- Create indexes for sub-assembly queries
CREATE INDEX IF NOT EXISTS idx_bom_materials_sub_assembly ON bom_materials(is_sub_assembly);
CREATE INDEX IF NOT EXISTS idx_bom_materials_sub_assembly_bom_id ON bom_materials(sub_assembly_bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_materials_level ON bom_materials(level);

-- Add comments
COMMENT ON COLUMN bom_materials.is_sub_assembly IS 'True if this material is actually a sub-assembly (another BOM)';
COMMENT ON COLUMN bom_materials.sub_assembly_bom_id IS 'Reference to the BOM of the sub-assembly';
COMMENT ON COLUMN bom_materials.level IS 'Hierarchy level (0=top level, 1=first sub-assembly, etc.)';

-- =============================================
-- STEP 3: ADD PARENT BOM TRACKING
-- =============================================

-- Add parent BOM reference to boms table for hierarchy
ALTER TABLE boms
ADD COLUMN IF NOT EXISTS parent_bom_id UUID REFERENCES boms(id),
ADD COLUMN IF NOT EXISTS is_sub_assembly BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_boms_parent_bom_id ON boms(parent_bom_id);
CREATE INDEX IF NOT EXISTS idx_boms_is_sub_assembly ON boms(is_sub_assembly);
CREATE INDEX IF NOT EXISTS idx_boms_hierarchy_level ON boms(hierarchy_level);

-- Add comments
COMMENT ON COLUMN boms.parent_bom_id IS 'Parent BOM if this is used as a sub-assembly';
COMMENT ON COLUMN boms.is_sub_assembly IS 'True if this BOM is used as a sub-assembly in other BOMs';
COMMENT ON COLUMN boms.hierarchy_level IS 'Level in BOM hierarchy (0=finished goods, 1+=sub-assemblies)';

-- =============================================
-- STEP 4: CREATE RECURSIVE BOM VIEW
-- =============================================

-- Create a view for exploded BOM (all levels flattened)
CREATE OR REPLACE VIEW bom_exploded AS
WITH RECURSIVE bom_hierarchy AS (
    -- Base case: top-level materials
    SELECT 
        bm.id,
        bm.bom_id,
        bm.material_id,
        bm.quantity,
        bm.unit,
        bm.scrap_percentage,
        bm.unit_cost,
        bm.sequence_number,
        bm.is_sub_assembly,
        bm.sub_assembly_bom_id,
        0 as level,
        CAST(bm.quantity AS NUMERIC) as total_quantity,
        ARRAY[bm.material_id] as path
    FROM bom_materials bm
    WHERE bm.level = 0
    
    UNION ALL
    
    -- Recursive case: sub-assembly materials
    SELECT 
        bm.id,
        bh.bom_id,
        bm.material_id,
        bm.quantity,
        bm.unit,
        bm.scrap_percentage,
        bm.unit_cost,
        bm.sequence_number,
        bm.is_sub_assembly,
        bm.sub_assembly_bom_id,
        bh.level + 1,
        CAST(bh.total_quantity * bm.quantity AS NUMERIC) as total_quantity,
        bh.path || bm.material_id
    FROM bom_materials bm
    INNER JOIN bom_hierarchy bh ON bm.bom_id = bh.sub_assembly_bom_id
    WHERE bm.material_id <> ALL(bh.path) -- Prevent circular references
)
SELECT * FROM bom_hierarchy;

-- =============================================
-- STEP 5: ADD VALIDATION CONSTRAINTS
-- =============================================

-- Drop constraints if they exist, then add them
ALTER TABLE bom_materials DROP CONSTRAINT IF EXISTS check_no_self_reference;
ALTER TABLE bom_materials DROP CONSTRAINT IF EXISTS check_sub_assembly_consistency;

-- Add check constraint to prevent circular references
ALTER TABLE bom_materials
ADD CONSTRAINT check_no_self_reference 
CHECK (bom_id != sub_assembly_bom_id);

-- Add check constraint for sub-assembly consistency
ALTER TABLE bom_materials
ADD CONSTRAINT check_sub_assembly_consistency
CHECK (
    (is_sub_assembly = true AND sub_assembly_bom_id IS NOT NULL) OR
    (is_sub_assembly = false AND sub_assembly_bom_id IS NULL)
);

-- =============================================
-- STEP 6: CREATE HELPER FUNCTIONS
-- =============================================

-- Function to get total material cost including sub-assemblies
CREATE OR REPLACE FUNCTION get_bom_total_cost(p_bom_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    total_cost DECIMAL(15,2);
BEGIN
    SELECT COALESCE(SUM(
        CASE 
            WHEN bm.is_sub_assembly THEN 
                get_bom_total_cost(bm.sub_assembly_bom_id) * bm.quantity
            ELSE 
                bm.quantity * bm.unit_cost * (1 + bm.scrap_percentage / 100)
        END
    ), 0)
    INTO total_cost
    FROM bom_materials bm
    WHERE bm.bom_id = p_bom_id;
    
    RETURN total_cost;
END;
$$ LANGUAGE plpgsql;

-- Function to check for circular BOM references
CREATE OR REPLACE FUNCTION check_bom_circular_reference(
    p_bom_id UUID,
    p_sub_assembly_bom_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    has_circular BOOLEAN;
BEGIN
    -- Check if sub_assembly_bom_id contains p_bom_id in its hierarchy
    WITH RECURSIVE bom_tree AS (
        SELECT sub_assembly_bom_id as bom_id
        FROM bom_materials
        WHERE bom_id = p_sub_assembly_bom_id
        
        UNION
        
        SELECT bm.sub_assembly_bom_id
        FROM bom_materials bm
        INNER JOIN bom_tree bt ON bm.bom_id = bt.bom_id
        WHERE bm.is_sub_assembly = true
    )
    SELECT EXISTS(
        SELECT 1 FROM bom_tree WHERE bom_id = p_bom_id
    ) INTO has_circular;
    
    RETURN has_circular;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 7: UPDATE EXISTING DATA
-- =============================================

-- Set default values for existing records
UPDATE production_orders 
SET bom_version = 1 
WHERE bom_version IS NULL AND product_id IN (
    SELECT product_id FROM boms WHERE is_active = true
);

-- Update bom_id for existing production orders
UPDATE production_orders po
SET bom_id = b.id
FROM boms b
WHERE po.product_id = b.product_id 
  AND b.is_active = true
  AND po.bom_id IS NULL;

-- =============================================
-- STEP 8: VERIFY DATA
-- =============================================

-- Check production orders with BOM tracking
SELECT 
    po.order_number,
    p.name as product_name,
    po.bom_version,
    b.version as current_bom_version,
    CASE 
        WHEN po.bom_version = b.version THEN 'Current'
        WHEN po.bom_version < b.version THEN 'Outdated'
        ELSE 'Unknown'
    END as bom_status
FROM production_orders po
JOIN products p ON po.product_id = p.id
LEFT JOIN boms b ON po.bom_id = b.id
WHERE po.bom_id IS NOT NULL
LIMIT 10;

-- Check for any sub-assemblies
SELECT 
    b.id,
    p.code as product_code,
    p.name as product_name,
    b.is_sub_assembly,
    b.hierarchy_level,
    COUNT(bm.id) as material_count
FROM boms b
JOIN products p ON b.product_id = p.id
LEFT JOIN bom_materials bm ON b.id = bm.bom_id
GROUP BY b.id, p.code, p.name, b.is_sub_assembly, b.hierarchy_level
ORDER BY b.hierarchy_level, p.code;
