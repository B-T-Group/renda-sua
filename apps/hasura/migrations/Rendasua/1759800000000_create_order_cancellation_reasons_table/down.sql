-- Drop the trigger first
DROP TRIGGER IF EXISTS set_public_order_cancellation_reasons_updated_at ON public.order_cancellation_reasons;

-- Drop the order_cancellation_reasons table
DROP TABLE IF EXISTS public.order_cancellation_reasons;
