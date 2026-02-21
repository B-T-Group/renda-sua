ALTER TABLE public.items DROP COLUMN IF EXISTS status;
DROP TYPE IF EXISTS public.item_status_enum;
