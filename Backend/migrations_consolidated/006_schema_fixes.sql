-- =============================================
-- 006: SCHEMA FIXES (Revised)
-- Purpose: Support Frontend payloads for PO/WO creation
-- Idempotent: Can be run multiple times without error
-- =============================================

SET search_path TO public;

-- 1. PURCHASE ORDERS: Add missing columns
-- Using 'IF NOT EXISTS' to ensure idempotency
ALTER TABLE purchase_orders 
    ADD COLUMN IF NOT EXISTS shift_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ocr_document_url TEXT,
    ADD COLUMN IF NOT EXISTS ocr_extracted_data JSONB;

-- 2. WORK ORDERS: Relax constraints
-- We must drop the old strict constraints (Medium only) effectively 
-- to allow 'Normal' (Frontend default) and 'Pending'.

-- Drop constraints using the standard Postgres naming convention confirmed by error logs
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_priority_check;
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;

-- Re-add constraints with expanded allowed values
-- Priority: Added 'Normal'
ALTER TABLE work_orders 
    ADD CONSTRAINT work_orders_priority_check 
    CHECK (priority IN ('Low', 'Normal', 'Medium', 'High', 'Urgent'));

-- Status: Added 'Pending', 'Draft'
ALTER TABLE work_orders 
    ADD CONSTRAINT work_orders_status_check 
    CHECK (status IN ('Pending', 'Draft', 'Planned', 'Released', 'In Progress', 'On Hold', 'Completed', 'Cancelled'));

-- 2.1 WORK ORDERS: Fix Shift Constraint (Frontend sends 'Evening', Schema had 'Afternoon')
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_shift_check;

ALTER TABLE work_orders 
    ADD CONSTRAINT work_orders_shift_check 
    CHECK (shift IN ('Morning', 'Afternoon', 'Evening', 'Night', 'Custom'));

-- 3. WORK ORDERS: Ensure defaults
-- Use SET DEFAULT to handle missing fields in payload
ALTER TABLE work_orders ALTER COLUMN completed_qty SET DEFAULT 0;
ALTER TABLE work_orders ALTER COLUMN rejected_qty SET DEFAULT 0;
