-- Migration: 008_qc_module
-- Description: Create tables for Quality Control (QC) module

-- Create QC Inspections table
CREATE TABLE IF NOT EXISTS public.qc_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_number TEXT NOT NULL UNIQUE,
    purchase_order_id UUID REFERENCES public.purchase_orders(id),
    product_id UUID REFERENCES public.products(id) NOT NULL,
    quantity_checked NUMERIC NOT NULL DEFAULT 0,
    passed_qty NUMERIC NOT NULL DEFAULT 0,
    rework_qty NUMERIC NOT NULL DEFAULT 0,
    scrap_qty NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    inspector_id UUID REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create QC Defects table (for tracking reasons of rework/scrap)
CREATE TABLE IF NOT EXISTS public.qc_defects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID REFERENCES public.qc_inspections(id) ON DELETE CASCADE,
    defect_type TEXT NOT NULL CHECK (defect_type IN ('Rework', 'Scrap')),
    reason TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_defects ENABLE ROW LEVEL SECURITY;

-- Create policies (simplified for now - allow authenticated users)
CREATE POLICY "Enable read rights for all users" ON public.qc_inspections
    FOR SELECT USING (true);

CREATE POLICY "Enable insert rights for authenticated users" ON public.qc_inspections
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update rights for authenticated users" ON public.qc_inspections
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read rights for all users" ON public.qc_defects
    FOR SELECT USING (true);

CREATE POLICY "Enable insert rights for authenticated users" ON public.qc_defects
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create triggers for updated_at
CREATE TRIGGER update_qc_inspections_updated_at
    BEFORE UPDATE ON public.qc_inspections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
