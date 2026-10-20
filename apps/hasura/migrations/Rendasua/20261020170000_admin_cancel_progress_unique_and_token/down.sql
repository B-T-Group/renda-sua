SET LOCAL lock_timeout = '5s';
ALTER TABLE public.orders DROP COLUMN IF EXISTS admin_cancel_token;
DROP INDEX IF EXISTS public.order_events_admin_cancel_progress_uniq;
