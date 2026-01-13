-- =============================================
-- 9. GATE EXIT MODULE & GATE ENTRY REFINEMENTS
-- =============================================

-- 1. Create Gate Exits Table
CREATE TABLE IF NOT EXISTS gate_exits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exit_number VARCHAR(50) UNIQUE NOT NULL,
    exit_type VARCHAR(50) NOT NULL, -- dispatch, jobwork_out, scrap, etc.
    destination VARCHAR(255) NOT NULL,
    vehicle_no VARCHAR(50),
    driver_name VARCHAR(100),
    linked_document VARCHAR(100),
    materials JSONB DEFAULT '[]'::jsonb, -- Array of {name, code, qty, uom}
    status VARCHAR(50) DEFAULT 'ready', -- ready, verified, dispatched
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Add Photos to Gate Entries
ALTER TABLE gate_entries 
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- 3. RLS Policies for Gate Exits
ALTER TABLE gate_exits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gate Exits metadata visible to authenticated users"
    ON gate_exits FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create gate exits"
    ON gate_exits FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update gate exits"
    ON gate_exits FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Triggers
CREATE TRIGGER update_gate_exits_modtime
    BEFORE UPDATE ON gate_exits
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamps();
