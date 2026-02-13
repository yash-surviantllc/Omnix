-- =============================================
-- GATE ENTRY & EXIT TABLES - VERIFICATION AND FIX SCRIPT
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- PART 1: VERIFICATION QUERIES
-- =============================================

-- Check if gate_entries table exists and show its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'gate_entries'
ORDER BY ordinal_position;

-- Check if gate_exits table exists and show its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'gate_exits'
ORDER BY ordinal_position;

-- Check if gate_entry_materials table exists and show its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'gate_entry_materials'
ORDER BY ordinal_position;

-- Check constraints on gate_entries
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'gate_entries';

-- =============================================
-- PART 2: ADD MISSING COLUMNS TO gate_entries
-- =============================================

-- Add vendor column (required by service layer)
ALTER TABLE public.gate_entries 
ADD COLUMN IF NOT EXISTS vendor VARCHAR(255);

-- Add destination_department column (required by service layer)
ALTER TABLE public.gate_entries 
ADD COLUMN IF NOT EXISTS destination_department VARCHAR(100);

-- Add remarks column (required by service layer)
ALTER TABLE public.gate_entries 
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Add created_by column (for audit trail)
ALTER TABLE public.gate_entries 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- =============================================
-- PART 3: ADD MISSING COLUMNS TO gate_exits
-- =============================================

-- Add created_by column (for audit trail)
ALTER TABLE public.gate_exits 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- =============================================
-- PART 4: UPDATE CONSTRAINTS (if needed)
-- =============================================

-- Drop old entry_type constraint if it exists
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'gate_entries_entry_type_check'
    ) THEN
        ALTER TABLE public.gate_entries DROP CONSTRAINT gate_entries_entry_type_check;
    END IF;
END $$;

-- Add new entry_type constraint that accepts both old and new values
ALTER TABLE public.gate_entries 
ADD CONSTRAINT gate_entries_entry_type_check 
CHECK (entry_type IN (
    -- Original values (uppercase)
    'INBOUND', 'OUTBOUND', 'MATERIAL_TRANSFER', 'SCRAP', 'RETURN', 'SAMPLE',
    -- New values from service layer (lowercase)
    'material', 'courier', 'visitor', 'jobwork_return', 
    'subcontract_return', 'delivery', 'machine_spare',
    'inbound', 'outbound', 'material_transfer', 'scrap', 'return', 'sample'
));

-- Drop old status constraint if it exists
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'gate_entries_status_check'
    ) THEN
        ALTER TABLE public.gate_entries DROP CONSTRAINT gate_entries_status_check;
    END IF;
END $$;

-- Add new status constraint that accepts both old and new values
ALTER TABLE public.gate_entries 
ADD CONSTRAINT gate_entries_status_check 
CHECK (status IN (
    -- Original values (uppercase)
    'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
    -- New values from service layer (mixed case)
    'Arrived', 'Under Verification', 'Accepted', 'Rejected',
    -- Lowercase versions
    'arrived', 'under_verification', 'accepted', 'rejected', 'pending', 'in_progress', 'completed', 'cancelled'
));

-- =============================================
-- PART 5: ADD COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON COLUMN public.gate_entries.vendor IS 'Vendor or Supplier name for inbound materials';
COMMENT ON COLUMN public.gate_entries.destination_department IS 'Internal department receiving the materials (Store, QA, Maintenance, Production, Admin)';
COMMENT ON COLUMN public.gate_entries.remarks IS 'Additional notes or remarks about the entry';
COMMENT ON COLUMN public.gate_entries.created_by IS 'User who created this entry';
COMMENT ON COLUMN public.gate_exits.created_by IS 'User who created this exit';

-- =============================================
-- PART 6: VERIFICATION AFTER FIX
-- =============================================

-- Verify gate_entries columns after fix
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'gate_entries'
  AND column_name IN ('vendor', 'destination_department', 'remarks', 'created_by', 'vehicle_number')
ORDER BY column_name;

-- Verify gate_exits columns after fix
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'gate_exits'
  AND column_name IN ('created_by', 'vehicle_no', 'destination', 'materials')
ORDER BY column_name;

-- Verify gate_entry_materials table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'gate_entry_materials'
ORDER BY ordinal_position;

-- =============================================
-- PART 7: TEST QUERIES
-- =============================================

-- Test insert into gate_entries (should work after fix)
-- UNCOMMENT TO TEST:
/*
INSERT INTO public.gate_entries (
    entry_number, entry_type, vendor, vehicle_number, driver_name,
    destination_department, status, remarks
) VALUES (
    'GE-2026-TEST', 'material', 'Test Vendor', 'KA01AB1234', 'Test Driver',
    'Store', 'PENDING', 'Test entry'
) RETURNING *;
*/

-- Test insert into gate_exits (should work)
-- UNCOMMENT TO TEST:
/*
INSERT INTO public.gate_exits (
    exit_number, exit_type, destination, vehicle_no, driver_name,
    linked_document, materials, status, remarks
) VALUES (
    'GX-2026-TEST', 'dispatch', 'Customer ABC', 'KA01AB1234', 'Test Driver',
    'INV-001', '[]'::jsonb, 'ready', 'Test exit'
) RETURNING *;
*/

-- Clean up test data
-- UNCOMMENT TO CLEAN:
/*
DELETE FROM public.gate_entries WHERE entry_number = 'GE-2026-TEST';
DELETE FROM public.gate_exits WHERE exit_number = 'GX-2026-TEST';
*/

-- =============================================
-- END OF SCRIPT
-- =============================================
