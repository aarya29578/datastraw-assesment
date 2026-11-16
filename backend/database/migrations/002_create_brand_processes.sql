-- Migration: 002_create_brand_processes.sql
-- Purpose: Add dedicated normalized join table for Brand-Process associations
--          enabling independent representation without inventing default working rules.

CREATE TABLE IF NOT EXISTS public.brand_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_brand_process UNIQUE (brand_id, process_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_processes_brand_id ON public.brand_processes(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_processes_process_id ON public.brand_processes(process_id);
