-- =============================================
-- PURCHASE ORDER MULTI-SKU SUPPORT
-- Enable multiple SKUs per Purchase Order
-- =============================================

-- Create PO Items table to support multiple SKUs per PO
CREATE TABLE IF NOT EXISTS production_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON production_order_items(production_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product_id ON production_order_items(product_id);

-- Add trigger for updated_at
CREATE TRIGGER update_production_order_items_updated_at 
BEFORE UPDATE ON production_order_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add OCR document upload support to production orders
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS ocr_document_url TEXT,
ADD COLUMN IF NOT EXISTS ocr_extracted_data JSONB,
ADD COLUMN IF NOT EXISTS ocr_processed_at TIMESTAMP;

-- Add comments
COMMENT ON COLUMN production_orders.ocr_document_url IS 'URL to uploaded OCR document';
COMMENT ON COLUMN production_orders.ocr_extracted_data IS 'Extracted data from OCR processing';
COMMENT ON TABLE production_order_items IS 'Multiple SKU items per purchase order';

-- Migrate existing single-product orders to multi-SKU structure
INSERT INTO production_order_items (production_order_id, product_id, quantity, unit)
SELECT 
    po.id,
    po.product_id,
    po.quantity,
    po.unit
FROM production_orders po
WHERE po.product_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Note: We keep product_id, quantity, unit in production_orders for backward compatibility
-- New POs will use production_order_items table
