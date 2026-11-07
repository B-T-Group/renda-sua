-- Dedicated agent home: Ignore hides the early offer from dashboard/hub lists without
-- declining it. Reminder pushes and POST /orders/offer/accept still work until the gate.

ALTER TABLE public.order_offers
  ADD COLUMN IF NOT EXISTS dashboard_dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.order_offers.dashboard_dismissed_at IS
  'Agent tapped Ignore on home/hub. Row stays offered until gate; accept from a push still works.';
