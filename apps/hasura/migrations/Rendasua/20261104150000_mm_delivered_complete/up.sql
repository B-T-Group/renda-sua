-- Mobile Money "Delivered -> client Complete" (2h auto-complete, 1h reminder, 24h report window).
-- Reuses awaiting_client_confirmation (shown as "Delivered"); no new enum values.
-- Idempotent. In-flight non-Stripe orders get a deadline from the backend sweep (rail is resolved
-- in code, not SQL); here we only backfill delivered_at from the existing request timestamp.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_window_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_type TEXT,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_dispute_type_check
    CHECK (dispute_type IS NULL OR dispute_type IN ('issue', 'delivery_failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.orders.delivered_at IS
  'When the order was delivered: agent tapped Delivered, or client completed straight from out_for_delivery (same ts as completion).';
COMMENT ON COLUMN public.orders.report_window_ends_at IS
  'Client may still report an issue until this time (completion + client_confirm_report_window_hours).';

UPDATE public.orders
   SET delivered_at = client_confirmation_requested_at
 WHERE delivered_at IS NULL
   AND client_confirmation_requested_at IS NOT NULL
   AND current_status IN ('awaiting_client_confirmation', 'pending_auto_complete', 'disputed');

CREATE INDEX IF NOT EXISTS orders_awaiting_deadline_idx
  ON public.orders (auto_complete_deadline_at)
  WHERE current_status = 'awaiting_client_confirmation';

CREATE TABLE IF NOT EXISTS public.order_delivery_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('issue', 'delivery_failed')),
  reason TEXT NOT NULL,
  note TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  item_ids UUID[] NOT NULL DEFAULT '{}',
  phase TEXT NOT NULL CHECK (phase IN ('pre_completion', 'post_completion')),
  support_ticket_id UUID,
  outcome TEXT NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'supported', 'unsupported', 'partial')),
  resolution TEXT,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_delivery_reports_order_idx ON public.order_delivery_reports (order_id);
CREATE INDEX IF NOT EXISTS order_delivery_reports_client_outcome_idx
  ON public.order_delivery_reports (client_id, outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS order_delivery_reports_pending_idx
  ON public.order_delivery_reports (created_at) WHERE outcome = 'pending';

DROP TRIGGER IF EXISTS set_public_order_delivery_reports_updated_at ON public.order_delivery_reports;
CREATE TRIGGER set_public_order_delivery_reports_updated_at
  BEFORE UPDATE ON public.order_delivery_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TABLE public.order_delivery_reports IS
  'Client "Report an issue" / "Delivery failed" reports (pre- or post-completion). Resolved by admins; outcome=unsupported feeds the client flag.';

INSERT INTO public.application_configurations
  (config_key, config_name, description, data_type, number_value, min_value, max_value, country_code, tags, status)
SELECT v.k, v.n, v.d, 'number', v.val, v.mn, v.mx, NULL, ARRAY['delivery', 'client_confirm'], 'active'
FROM (VALUES
  ('client_confirm_momo_auto_complete_hours', 'MoMo delivered auto-complete hours',
   'Hours after the agent taps Delivered (non-Stripe markets) before the order auto-completes if the client reports nothing. Default 2. Running deadlines are not moved.', 2::numeric, 0.25::numeric, 72::numeric),
  ('client_confirm_momo_reminder_hours', 'MoMo delivered reminder hours',
   'Hours after Delivered before the client gets the push + SMS/WhatsApp reminder. Default 1.', 1, 0.1, 48),
  ('client_confirm_report_window_hours', 'Report-an-issue window after completion (hours)',
   'Hours after completion during which the client can still report an issue. Default 24.', 24, 1, 336),
  ('client_report_flag_threshold', 'Client unsupported-report flag threshold',
   'Number of unsupported delivery reports within the window that flags a client in admin. Default 2.', 2, 1, 50),
  ('client_report_flag_window_days', 'Client unsupported-report flag window (days)',
   'Look-back window in days for the client unsupported-report flag. Default 90.', 90, 1, 730)
) AS v(k, n, d, val, mn, mx)
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations c WHERE c.config_key = v.k AND c.country_code IS NULL
);

INSERT INTO public.delivery_failure_reasons (reason_key, reason_en, reason_fr, sort_order)
SELECT 'client_reported_not_delivered', 'Client reported the delivery never arrived',
       'Le client indique que la livraison n''est jamais arrivée', 9
WHERE NOT EXISTS (
  SELECT 1 FROM public.delivery_failure_reasons WHERE reason_key = 'client_reported_not_delivered'
);
