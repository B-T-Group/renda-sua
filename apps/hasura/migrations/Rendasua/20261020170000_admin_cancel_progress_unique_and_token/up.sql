-- #642 QA r2.
-- N1: at most one admin_cancel_progress row per order. The progress row is written
--     before the status CAS; without this, two concurrent fresh admin cancels could
--     both insert, and the older (losing) row would shadow the real one.
-- N2: orders.admin_cancel_token is stamped by the admin-cancel status CAS itself
--     (same UPDATE that sets current_status = 'cancelled'), with the progress row id,
--     so a resume can prove THIS cancel flipped the status.
--
-- Existing data: this migration does not delete or merge anything. If any order
-- already has more than one admin_cancel_progress row it FAILS LOUDLY (listing up to
-- 20 order ids) so a human decides which row is real; nothing is changed (the
-- migration runs in one transaction).
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(order_id::text, ', ')
    INTO dupes
    FROM (
      SELECT order_id
        FROM public.order_events
       WHERE event_type = 'admin_cancel_progress'
       GROUP BY order_id
      HAVING count(*) > 1
       LIMIT 20
    ) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'admin_cancel_progress has duplicate rows for orders: % -- resolve by hand before applying this migration', dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS order_events_admin_cancel_progress_uniq
  ON public.order_events (order_id)
  WHERE event_type = 'admin_cancel_progress';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS admin_cancel_token uuid NULL;

COMMENT ON COLUMN public.orders.admin_cancel_token IS
  'Set by the admin-cancel status CAS (same UPDATE as current_status=cancelled) to the admin_cancel_progress row id; proves which cancel flipped the status. Backend (system role) only.';
