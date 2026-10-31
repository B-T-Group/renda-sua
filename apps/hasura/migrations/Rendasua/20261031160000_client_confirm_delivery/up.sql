-- Client-confirmed delivery (replaces default doorstep PIN).
-- New order statuses, confirmation columns, proof photos, and per-market config.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_client_confirmation';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_auto_complete';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'disputed';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_confirmation_method TEXT,
  ADD COLUMN IF NOT EXISTS client_confirmation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_complete_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_proof_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS awaiting_confirm_reminder_1h_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS awaiting_confirm_reminder_24h_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS awaiting_confirm_support_ticket_id UUID;

COMMENT ON COLUMN public.orders.delivery_confirmation_method IS
  'How delivery completed: client, recipient, buyer, auto_complete, overwrite, pin (legacy).';
COMMENT ON COLUMN public.orders.client_confirmation_requested_at IS
  'When the agent marked the order delivered and asked the client to confirm.';
COMMENT ON COLUMN public.orders.auto_complete_deadline_at IS
  'Stripe fallback timer; frozen at submit so later config changes do not move it.';

CREATE INDEX IF NOT EXISTS orders_pending_auto_complete_deadline_idx
  ON public.orders (auto_complete_deadline_at)
  WHERE current_status = 'pending_auto_complete';

CREATE INDEX IF NOT EXISTS orders_awaiting_client_confirmation_idx
  ON public.orders (client_confirmation_requested_at)
  WHERE current_status = 'awaiting_client_confirmation';

CREATE TABLE IF NOT EXISTS public.order_delivery_proof_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_delivery_proof_photos_order_idx
  ON public.order_delivery_proof_photos (order_id);

COMMENT ON TABLE public.order_delivery_proof_photos IS
  'Agent photo proof for Stripe-rail "client could not confirm" fallback.';

-- Per-market client-confirm config. Country row wins; NULL country_code is the default.
INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type,
    number_value, min_value, max_value, country_code, tags, status
)
SELECT
    'client_confirm_auto_complete_hours',
    'Client-confirm auto-complete hours',
    'Hours after Stripe photo fallback before undisputed auto-complete. Default 2. Already-running timers are not moved.',
    'number', 2, 0.25, 72, NULL,
    ARRAY['delivery', 'client_confirm'],
    'active'
WHERE NOT EXISTS (
    SELECT 1 FROM public.application_configurations
    WHERE config_key = 'client_confirm_auto_complete_hours' AND country_code IS NULL
);

INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type,
    number_value, min_value, max_value, country_code, tags, status
)
SELECT
    'client_confirm_grace_minutes',
    'Client-confirm agent fallback grace minutes',
    'Minutes the agent must wait after mark-delivered before Stripe "client could not confirm" is allowed. Default 5.',
    'number', 5, 0, 60, NULL,
    ARRAY['delivery', 'client_confirm'],
    'active'
WHERE NOT EXISTS (
    SELECT 1 FROM public.application_configurations
    WHERE config_key = 'client_confirm_grace_minutes' AND country_code IS NULL
);

INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type,
    number_value, min_value, max_value, country_code, tags, status
)
SELECT
    'client_confirm_nonstripe_support_hours',
    'Non-Stripe stuck-order support hours',
    'Hours after mark-delivered on a non-Stripe market before a support ticket is opened. Default 48. Reminders at +1h and +24h.',
    'number', 48, 1, 168, NULL,
    ARRAY['delivery', 'client_confirm'],
    'active'
WHERE NOT EXISTS (
    SELECT 1 FROM public.application_configurations
    WHERE config_key = 'client_confirm_nonstripe_support_hours' AND country_code IS NULL
);

-- OQ1 (Samuel 2026-10-31): gift buyer may confirm on the recipient's behalf.
-- Flip boolean_value to false to require the recipient (or support) only.
INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type,
    boolean_value, country_code, tags, status
)
SELECT
    'client_confirm_gift_buyer_can_confirm',
    'Gift buyer can confirm delivery',
    'OQ1 default true: the gift buyer (order client) may confirm receipt on the recipient''s behalf. Set false to restrict confirm to the recipient / support.',
    'boolean', true, NULL,
    ARRAY['delivery', 'client_confirm'],
    'active'
WHERE NOT EXISTS (
    SELECT 1 FROM public.application_configurations
    WHERE config_key = 'client_confirm_gift_buyer_can_confirm' AND country_code IS NULL
);
