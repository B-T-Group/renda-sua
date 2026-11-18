DROP FUNCTION IF EXISTS public.close_decline_refund(
  uuid, uuid, text, text, text, uuid, numeric, text, text, uuid, text, text
);

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS refund_send_attempted_at;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'permissions'
  ) THEN
    DELETE FROM public.role_permissions
    WHERE permission_id IN (
      SELECT id FROM public.permissions WHERE key = 'platform.financial.refunds.manual_override'
    );
    DELETE FROM public.user_permissions
    WHERE permission_id IN (
      SELECT id FROM public.permissions WHERE key = 'platform.financial.refunds.manual_override'
    );
    DELETE FROM public.permissions WHERE key = 'platform.financial.refunds.manual_override';
  END IF;
END $$;
