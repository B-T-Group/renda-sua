-- Drop entity_type and entity_id columns from addresses table
ALTER TABLE public.addresses DROP COLUMN IF EXISTS entity_type;
ALTER TABLE public.addresses DROP COLUMN IF EXISTS entity_id;
