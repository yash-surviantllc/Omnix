-- =============================================
-- 007: QC MODULE ENHANCEMENTS
-- Add missing tables and link QC to work orders
-- =============================================

SET search_path TO public;

-- 1. ADD WORK_ORDER_ID TO QC_INSPECTIONS (Moved to 003)
-- ALTER TABLE qc_inspections 
-- ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE;

-- 2. CREATE QC_DEFECTS TABLE
CREATE TABLE IF NOT EXISTS qc_defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES qc_inspections(id) ON DELETE CASCADE,
    defect_type VARCHAR(20) NOT NULL CHECK (defect_type IN ('Rework', 'Scrap')),
    reason TEXT NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ADD REJECTED_QTY TO PURCHASE_ORDERS (Moved to 003)
-- DO $$
-- BEGIN
--     IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'rejected_qty') THEN
--         ALTER TABLE purchase_orders ADD COLUMN rejected_qty DECIMAL(15, 3) DEFAULT 0;
--     END IF;
-- END $$;

-- 4. UPDATE INDEXES (QC index moved to 003? No, keep here or move. keeping here is harmless)
CREATE INDEX IF NOT EXISTS idx_qc_inspections_wo ON qc_inspections(work_order_id);
CREATE INDEX IF NOT EXISTS idx_qc_defects_inspection ON qc_defects(inspection_id);
