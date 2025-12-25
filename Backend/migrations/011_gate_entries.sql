-- =============================================
-- GATE ENTRIES TABLE (Inward)
-- =============================================
CREATE TABLE IF NOT EXISTS gate_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN (
        'material', 'courier', 'visitor', 'jobwork_return', 
        'subcontract_return', 'delivery', 'machine_spare'
    )),
    vendor VARCHAR(255) NOT NULL,
    vehicle_no VARCHAR(50),
    driver_name VARCHAR(255),
    linked_document VARCHAR(100),
    destination_department VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'arrived' CHECK (status IN (
        'arrived', 'under_verification', 'accepted', 'rejected'
    )),
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gate_entries_entry_number ON gate_entries(entry_number);
CREATE INDEX idx_gate_entries_entry_type ON gate_entries(entry_type);
CREATE INDEX idx_gate_entries_vendor ON gate_entries(vendor);
CREATE INDEX idx_gate_entries_status ON gate_entries(status);
CREATE INDEX idx_gate_entries_created_at ON gate_entries(created_at);
CREATE INDEX idx_gate_entries_destination ON gate_entries(destination_department);

-- =============================================
-- GATE ENTRY MATERIALS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS gate_entry_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gate_entry_id UUID NOT NULL REFERENCES gate_entries(id) ON DELETE CASCADE,
    material_code VARCHAR(100),
    material_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    uom VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gate_entry_materials_entry_id ON gate_entry_materials(gate_entry_id);
CREATE INDEX idx_gate_entry_materials_code ON gate_entry_materials(material_code);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_gate_entries_updated_at BEFORE UPDATE ON gate_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gate_entry_materials_updated_at BEFORE UPDATE ON gate_entry_materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- GATE ENTRY NUMBER SEQUENCE
-- =============================================
CREATE SEQUENCE IF NOT EXISTS gate_entry_seq START WITH 1;

-- =============================================
-- SAMPLE DATA
-- =============================================
INSERT INTO gate_entries (
    entry_number, entry_type, vendor, vehicle_no, driver_name, 
    linked_document, destination_department, status, remarks
)
VALUES
    ('GE-2024-0001', 'material', 'ABC Textiles', 'KA-01-AB-1234', 'Ramesh Kumar', 
     'PO-1001', 'Store', 'accepted', 'Quality verified'),
    ('GE-2024-0002', 'courier', 'BlueDart', 'N/A', 'Delivery Agent', 
     'AWB-789456', 'Admin', 'accepted', 'Signed by reception'),
    ('GE-2024-0003', 'jobwork_return', 'XYZ Stitching Co.', 'KA-05-CD-5678', 'Suresh', 
     'JW-DC-123', 'QA', 'under_verification', 'QA inspection pending')
ON CONFLICT (entry_number) DO NOTHING;

-- Insert materials for gate entries
DO $$
DECLARE
    v_entry_id_1 UUID;
    v_entry_id_2 UUID;
    v_entry_id_3 UUID;
BEGIN
    SELECT id INTO v_entry_id_1 FROM gate_entries WHERE entry_number = 'GE-2024-0001';
    SELECT id INTO v_entry_id_2 FROM gate_entries WHERE entry_number = 'GE-2024-0002';
    SELECT id INTO v_entry_id_3 FROM gate_entries WHERE entry_number = 'GE-2024-0003';
    
    IF v_entry_id_1 IS NOT NULL THEN
        INSERT INTO gate_entry_materials (gate_entry_id, material_code, material_name, quantity, uom)
        VALUES (v_entry_id_1, 'RM-001', 'Cotton Yarn', 600, 'kg');
    END IF;
    
    IF v_entry_id_2 IS NOT NULL THEN
        INSERT INTO gate_entry_materials (gate_entry_id, material_code, material_name, quantity, uom)
        VALUES (v_entry_id_2, 'N/A', 'Documents Package', 1, 'pcs');
    END IF;
    
    IF v_entry_id_3 IS NOT NULL THEN
        INSERT INTO gate_entry_materials (gate_entry_id, material_code, material_name, quantity, uom)
        VALUES (v_entry_id_3, 'WIP-045', 'Stitched T-Shirt Panels', 500, 'pcs');
    END IF;
END $$;
