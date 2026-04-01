-- =============================================
-- 012: ADD BOM VERSION SNAPSHOT
-- Add missing snapshot column to bom_versions table
-- =============================================

SET search_path TO public;

-- Add the missing JSONB snapshot column
ALTER TABLE bom_versions
ADD COLUMN IF NOT EXISTS snapshot JSONB;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
