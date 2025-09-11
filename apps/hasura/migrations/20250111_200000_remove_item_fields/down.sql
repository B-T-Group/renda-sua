-- Restore material, size, and size_unit columns to items table
ALTER TABLE public.items 
ADD COLUMN material TEXT,
ADD COLUMN size NUMERIC,
ADD COLUMN size_unit size_units_enum;
