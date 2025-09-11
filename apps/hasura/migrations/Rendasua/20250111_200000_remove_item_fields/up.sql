-- Remove material, size, and size_unit columns from items table
ALTER TABLE public.items 
DROP COLUMN IF EXISTS material,
DROP COLUMN IF EXISTS size,
DROP COLUMN IF EXISTS size_unit;
