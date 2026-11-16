-- Migration: 001_add_pod_id_to_brands.sql
-- Purpose: Add additive, non-destructive pod_id column to brands table for direct organizational mapping.

ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brands_pod_id ON public.brands(pod_id);
