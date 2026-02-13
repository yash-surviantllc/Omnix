-- FIX FOR GATE_ENTRIES TABLE
-- Run this in the Supabase SQL Editor

-- 1. Add missing columns
ALTER TABLE public.gate_entries 
ADD COLUMN IF NOT EXISTS vendor VARCHAR(255),
ADD COLUMN IF NOT EXISTS destination_department VARCHAR(100),
ADD COLUMN IF NOT EXISTS remarks TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Update entry_type constraint if necessary
-- First, drop the old constraint if it exists (may have a generated name, or we can check)
-- DO $$ 
-- BEGIN 
--     IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'gate_entries' AND constraint_name = 'gate_entries_entry_type_check') THEN
--         ALTER TABLE public.gate_entries DROP CONSTRAINT gate_entries_entry_type_check;
--     END IF;
-- END $$;

-- 3. Standardize column names (if migration mismatches vehicle_number/vehicle_no)
-- Backend expects 'vehicle_number' based on migration 002 but might be using 'vehicle_no' in some places.
-- Let's stick to vehicle_number as primary but ensure the service handles mapping.

COMMENT ON COLUMN public.gate_entries.vendor IS 'Vendor or Supplier name for inbound materials';
COMMENT ON COLUMN public.gate_entries.destination_department IS 'Internal department receiving the materials';
