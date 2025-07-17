-- Drop trigger first
DROP TRIGGER IF EXISTS set_public_order_holds_updated_at ON public.order_holds;

-- Drop table
DROP TABLE IF EXISTS public.order_holds;

-- Drop enum
DROP TYPE IF EXISTS public.order_hold_status_enum;
