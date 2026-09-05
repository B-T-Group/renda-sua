DELETE FROM public.application_configurations
WHERE country_code IS NULL
  AND config_key IN (
    'order_risk_alert_enabled',
    'order_risk_alert_min_severity',
    'order_risk_alert_repeat_minutes',
    'order_risk_pending_acceptance_grace_minutes',
    'order_risk_pending_fallback_minutes',
    'order_risk_ready_unassigned_minutes',
    'order_risk_pickup_overdue_grace_minutes',
    'order_risk_delivery_delayed_minutes',
    'order_risk_critical_after_minutes'
  );

DROP TRIGGER IF EXISTS sync_order_open_risk_after_write ON public.order_risk_incidents;

DROP TABLE IF EXISTS public.order_risk_incidents;

DROP FUNCTION IF EXISTS public.sync_order_open_risk();

DROP FUNCTION IF EXISTS public.refresh_order_open_risk(uuid);

DROP INDEX IF EXISTS public.idx_orders_open_risk;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS open_risk_rank,
  DROP COLUMN IF EXISTS open_risk_since,
  DROP COLUMN IF EXISTS open_risk_type;

DROP TYPE IF EXISTS public.order_risk_severity;

DROP TYPE IF EXISTS public.order_risk_type;
