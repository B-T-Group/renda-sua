-- Durable order risk incidents: one open incident per (order, risk type) so the
-- every-minute monitor can escalate without re-alerting superusers on each tick.

CREATE TYPE public.order_risk_type AS ENUM (
  'pending_acceptance',
  'ready_unassigned',
  'pickup_overdue',
  'delivery_delayed'
);

CREATE TYPE public.order_risk_severity AS ENUM (
  'warning',
  'critical'
);

CREATE TABLE IF NOT EXISTS public.order_risk_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  risk_type public.order_risk_type NOT NULL,
  severity public.order_risk_severity NOT NULL DEFAULT 'warning',
  detected_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text,
  due_at timestamptz,
  overdue_minutes integer NOT NULL DEFAULT 0,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_notified_at timestamptz,
  last_notified_severity public.order_risk_severity,
  notified_count integer NOT NULL DEFAULT 0,
  notified_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  acknowledged_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_risk_incidents IS 'Open/resolved operational risk incidents used for superuser intervention and alert de-duplication';
COMMENT ON COLUMN public.order_risk_incidents.resolution IS 'auto_resolved | order_closed | acknowledged_resolved';
COMMENT ON COLUMN public.order_risk_incidents.notified_channels IS 'Channel attempt results from the last superuser alert';

-- Guarantees a single open incident per order + risk type even if two writers race.
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_risk_incidents_open
  ON public.order_risk_incidents (order_id, risk_type)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_risk_incidents_open_severity
  ON public.order_risk_incidents (severity, detected_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_risk_incidents_order
  ON public.order_risk_incidents (order_id, detected_at DESC);

CREATE TRIGGER set_public_order_risk_incidents_updated_at
  BEFORE UPDATE ON public.order_risk_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Denormalized summary of the open incidents so the admin queue can filter, sort,
-- and paginate on risk in a single indexed pass over orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS open_risk_rank integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_risk_since timestamptz,
  ADD COLUMN IF NOT EXISTS open_risk_type public.order_risk_type;

COMMENT ON COLUMN public.orders.open_risk_rank IS '0 none, 1 warning, 2 critical — highest open incident severity';
COMMENT ON COLUMN public.orders.open_risk_since IS 'Detection time of the oldest open risk incident';

CREATE INDEX IF NOT EXISTS idx_orders_open_risk
  ON public.orders (open_risk_rank DESC, open_risk_since ASC)
  WHERE open_risk_rank > 0;

CREATE OR REPLACE FUNCTION public.refresh_order_open_risk(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_rank integer := 0;
  v_since timestamptz;
  v_type public.order_risk_type;
BEGIN
  SELECT
    COALESCE(MAX(CASE WHEN i.severity = 'critical' THEN 2 ELSE 1 END), 0),
    MIN(i.detected_at)
  INTO v_rank, v_since
  FROM public.order_risk_incidents i
  WHERE i.order_id = p_order_id
    AND i.resolved_at IS NULL;

  IF v_rank > 0 THEN
    SELECT i.risk_type
    INTO v_type
    FROM public.order_risk_incidents i
    WHERE i.order_id = p_order_id
      AND i.resolved_at IS NULL
    ORDER BY (CASE WHEN i.severity = 'critical' THEN 2 ELSE 1 END) DESC,
             i.detected_at ASC
    LIMIT 1;
  END IF;

  UPDATE public.orders
  SET open_risk_rank = v_rank,
      open_risk_since = v_since,
      open_risk_type = v_type
  WHERE id = p_order_id
    AND (
      open_risk_rank IS DISTINCT FROM v_rank
      OR open_risk_since IS DISTINCT FROM v_since
      OR open_risk_type IS DISTINCT FROM v_type
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_order_open_risk()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_order_open_risk(OLD.order_id);
    RETURN OLD;
  END IF;
  PERFORM public.refresh_order_open_risk(NEW.order_id);
  IF TG_OP = 'UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    PERFORM public.refresh_order_open_risk(OLD.order_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_order_open_risk_after_write
  AFTER INSERT OR UPDATE OR DELETE ON public.order_risk_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_open_risk();

-- country_code stays NULL for these platform defaults, and NULLs are distinct in the
-- (config_key, country_code) unique constraint, so guard the seed with NOT EXISTS.
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
      'order_risk_alert_enabled',
      'Order Risk Alerts Enabled',
      'When 1, open order risk incidents notify platform superusers',
      'number',
      1::numeric,
      NULL::text,
      ARRAY['order', 'risk', 'alerts']
    ),
    (
      'order_risk_alert_min_severity',
      'Order Risk Alert Minimum Severity',
      'Lowest incident severity that alerts superusers (warning | critical)',
      'string',
      NULL::numeric,
      'warning',
      ARRAY['order', 'risk', 'alerts']
    ),
    (
      'order_risk_alert_repeat_minutes',
      'Order Risk Alert Repeat Minutes',
      'Minutes before an unresolved incident re-alerts superusers',
      'number',
      60::numeric,
      NULL::text,
      ARRAY['order', 'risk', 'alerts']
    ),
    (
      'order_risk_pending_acceptance_grace_minutes',
      'Order Risk Pending Acceptance Grace Minutes',
      'Minutes past the merchant acceptance deadline before an order is at risk',
      'number',
      5::numeric,
      NULL::text,
      ARRAY['order', 'risk']
    ),
    (
      'order_risk_pending_fallback_minutes',
      'Order Risk Pending Fallback Minutes',
      'Minutes a pending order may age without an acceptance deadline before it is at risk',
      'number',
      30::numeric,
      NULL::text,
      ARRAY['order', 'risk']
    ),
    (
      'order_risk_ready_unassigned_minutes',
      'Order Risk Ready Unassigned Minutes',
      'Minutes a delivery order may stay ready_for_pickup without an agent before it is at risk',
      'number',
      30::numeric,
      NULL::text,
      ARRAY['order', 'risk']
    ),
    (
      'order_risk_pickup_overdue_grace_minutes',
      'Order Risk Pickup Overdue Grace Minutes',
      'Minutes past pickup_due_at before an assigned order is at risk',
      'number',
      10::numeric,
      NULL::text,
      ARRAY['order', 'risk']
    ),
    (
      'order_risk_delivery_delayed_minutes',
      'Order Risk Delivery Delayed Minutes',
      'Minutes in delivery without an ETA before an order is at risk',
      'number',
      60::numeric,
      NULL::text,
      ARRAY['order', 'risk']
    ),
    (
      'order_risk_critical_after_minutes',
      'Order Risk Critical After Minutes',
      'Minutes overdue before an incident escalates from warning to critical',
      'number',
      60::numeric,
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
