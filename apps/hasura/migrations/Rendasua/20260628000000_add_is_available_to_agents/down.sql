-- Remove is_available column from agents table
ALTER TABLE public.agents DROP COLUMN IF EXISTS is_available;
