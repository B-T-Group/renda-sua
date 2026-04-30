DROP TRIGGER IF EXISTS trigger_order_discount_codes_updated_at ON public.order_discount_codes;
DROP FUNCTION IF EXISTS public.update_order_discount_codes_updated_at();

DROP TABLE IF EXISTS public.order_discount_codes;

DROP TYPE IF EXISTS public.discount_code_type;

