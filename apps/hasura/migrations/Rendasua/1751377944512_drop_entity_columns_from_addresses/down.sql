-- Add back entity_type and entity_id columns to addresses table
ALTER TABLE public.addresses ADD COLUMN entity_type VARCHAR(50);
ALTER TABLE public.addresses ADD COLUMN entity_id UUID;
