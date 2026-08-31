DELETE FROM public.message_types WHERE id = 'PRODUCT_INTEREST';
DROP TABLE IF EXISTS public.product_interest_requests;
ALTER TABLE public.items DROP COLUMN IF EXISTS interest_only;
