-- Add back the available_quantity column
ALTER TABLE public.business_inventory ADD COLUMN available_quantity INTEGER NOT NULL DEFAULT 0;
