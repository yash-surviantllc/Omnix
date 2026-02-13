-- =============================================
-- PRE-EXECUTION SCRIPT FOR 008_missing_tables.sql
-- Handle conflicts before creating new tables
-- =============================================

SET search_path TO public;

-- =============================================
-- 1. CHECK gate_entry_items DATA
-- =============================================
DO $$
DECLARE
    item_count INTEGER;
BEGIN
    -- Check if gate_entry_items exists and has data
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_items') THEN
        SELECT COUNT(*) INTO item_count FROM gate_entry_items;
        
        RAISE NOTICE 'gate_entry_items table exists with % rows', item_count;
        
        IF item_count > 0 THEN
            RAISE NOTICE 'WARNING: gate_entry_items has data. Manual migration needed!';
            RAISE NOTICE 'Please review data before proceeding.';
        ELSE
            RAISE NOTICE 'gate_entry_items is empty. Safe to drop.';
            -- Drop the empty table
            DROP TABLE gate_entry_items CASCADE;
            RAISE NOTICE 'Dropped gate_entry_items table.';
        END IF;
    ELSE
        RAISE NOTICE 'gate_entry_items does not exist. No action needed.';
    END IF;
END $$;

-- =============================================
-- 2. VERIFICATION
-- =============================================
SELECT 
    'Pre-execution check complete' as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gate_entry_items')
        THEN 'gate_entry_items still exists - REVIEW NEEDED'
        ELSE 'Ready to create gate_entry_materials'
    END as gate_entry_status;
