DROP INDEX IF EXISTS public.user_recipients_address_id_idx;
ALTER TABLE public.user_recipients DROP COLUMN IF EXISTS address_id;
