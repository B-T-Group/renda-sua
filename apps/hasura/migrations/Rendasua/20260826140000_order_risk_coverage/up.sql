-- Closes four gaps in order risk coverage:
--   1. confirmed/preparing orders had no rule at all
--   2. scheduled acceptance was exempt forever, even past its activation time
--   3. store pickup / shipping orders were excluded from the ready rule
--   4. the rules anchored on orders.updated_at, which a BEFORE UPDATE trigger
--      resets on every write, so an order being touched could never age into risk

-- 1. A status anchor that only moves when the status actually moves.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

COMMENT ON COLUMN public.orders.status_changed_at IS 'When current_status last changed. Unlike updated_at this is not reset by unrelated row writes, so risk rules can measure time-in-status.';

CREATE OR REPLACE FUNCTION public.set_order_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status_changed_at = COALESCE(NEW.status_changed_at, NEW.created_at, now());
  ELSIF NEW.current_status IS DISTINCT FROM OLD.current_status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_order_status_changed_at ON public.orders;

CREATE TRIGGER trigger_set_order_status_changed_at
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_status_changed_at();

-- Backfill from order_status_history. Deliberately never falls back to updated_at:
-- that is the column this whole change exists to stop trusting, and seeding a
-- recent value would hide exactly the stalled orders we want surfaced. Each
-- fallback is therefore the oldest defensible anchor, so a stalled order is
-- flagged immediately and a healthy one clears itself on its next transition.
UPDATE public.orders o
SET status_changed_at = COALESCE(
  -- when it entered the status it is in now
  (
    SELECT MAX(h.created_at)
    FROM public.order_status_history h
    WHERE h.order_id = o.id
      AND h.status = o.current_status
  ),
  -- no row for the current status: the last logged transition is the newest
  -- moment it could have entered that status
  (
    SELECT MAX(h.created_at)
    FROM public.order_status_history h
    WHERE h.order_id = o.id
  ),
  o.created_at,
  now()
)
WHERE o.status_changed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status_changed_at
  ON public.orders (current_status, status_changed_at);

-- 2. Risk types for the newly covered states.
ALTER TYPE public.order_risk_type ADD VALUE IF NOT EXISTS 'prep_overdue';
ALTER TYPE public.order_risk_type ADD VALUE IF NOT EXISTS 'pickup_uncollected';

-- 3. Thresholds for the new rules. country_code stays NULL for platform defaults,
-- and NULLs are distinct in the (config_key, country_code) unique constraint, so
-- guard the seed with NOT EXISTS to stay idempotent.
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  number_value,
  string_value,
  country_code,
  status,
  version,
  tags
)
SELECT
  seed.config_key,
  seed.config_name,
  seed.description,
  seed.data_type,
  seed.number_value,
  seed.string_value,
  NULL,
  'active',
  1,
  seed.tags
FROM (
  VALUES
    (
      'order_risk_prep_overdue_minutes',
      'Order Risk Prep Overdue Minutes',
      'Minutes a confirmed order may stay unprepared, past promised_ready_at or accepted_at, before it is at risk',
      'number',
      45::numeric,
      NULL::text,
      ARRAY['order', 'risk']
    ),
    (
      'order_risk_pickup_uncollected_minutes',
      'Order Risk Pickup Uncollected Minutes',
      'Minutes a store pickup or shipping order may sit ready without being collected before it is at risk',
      'number',
      720::numeric,
      NULL::text,
      ARRAY['order', 'risk']
    ),
    (
      'order_risk_scheduled_activation_grace_minutes',
      'Order Risk Scheduled Activation Grace Minutes',
      'Minutes past acceptance_activates_at before a still-scheduled order is treated as a stalled activation',
      'number',
      15::numeric,
      NULL::text,
      ARRAY['order', 'risk']
    )
) AS seed (
  config_key,
  config_name,
  description,
  data_type,
  number_value,
  string_value,
  tags
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.application_configurations existing
  WHERE existing.config_key = seed.config_key
    AND existing.country_code IS NULL
);
