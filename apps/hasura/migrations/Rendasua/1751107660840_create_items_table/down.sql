-- Drop the trigger first
DROP TRIGGER IF EXISTS set_public_items_updated_at ON public.items;

-- Drop the items table
DROP TABLE IF EXISTS public.items;

-- Drop the enum types
DROP TYPE IF EXISTS public.size_units_enum;
DROP TYPE IF EXISTS public.weight_units_enum;
