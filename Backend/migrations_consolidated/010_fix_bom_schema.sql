-- Migration: 010_fix_bom_schema
-- Description: Add missing 'code' column to boms table if it doesn't exist.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'boms'
        AND column_name = 'code'
    ) THEN
        ALTER TABLE boms ADD COLUMN code VARCHAR(50);
        -- Add a temporary unique constraint that ignores nulls initially if needed,
        -- but ideally we want it unique. Since table might have data, we might need to backfill.
        -- For now, allow nullable to avoid breaking existing rows, or backfill with a generated code.
        
        -- Update existing rows with a generated code
        UPDATE boms SET code = 'BOM-' || substring(id::text from 1 for 8) WHERE code IS NULL;
        
        -- Now set not null and unique
        ALTER TABLE boms ALTER COLUMN code SET NOT NULL;
        ALTER TABLE boms ADD CONSTRAINT boms_code_key UNIQUE (code);
    END IF;
END $$;
