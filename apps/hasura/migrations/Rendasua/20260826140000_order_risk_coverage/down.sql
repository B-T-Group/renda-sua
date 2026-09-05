DELETE FROM public.application_configurations
WHERE country_code IS NULL
  AND config_key IN (
    'order_risk_prep_overdue_minutes',
    'order_risk_pickup_uncollected_minutes',
    'order_risk_scheduled_activation_grace_minutes'
  );

-- Postgres cannot drop a single enum value, so rebuild order_risk_type without the
-- two added labels. Incidents using them go first; the delete trigger recomputes
-- the denormalized summary, and the update below clears anything it left behind.
DELETE FROM public.order_risk_incidents
WHERE risk_type IN ('prep_overdue', 'pickup_uncollected');

UPDATE public.orders
SET open_risk_type = NULL
WHERE open_risk_type IN ('prep_overdue', 'pickup_uncollected');

ALTER TYPE public.order_risk_type RENAME TO order_risk_type_old;

CREATE TYPE public.order_risk_type AS ENUM (
  'pending_acceptance',
  'ready_unassigned',
  'pickup_overdue',
  'delivery_delayed'
);

ALTER TABLE public.order_risk_incidents
  ALTER COLUMN risk_type TYPE public.order_risk_type
  USING risk_type::text::public.order_risk_type;

ALTER TABLE public.orders
  ALTER COLUMN open_risk_type TYPE public.order_risk_type
  USING open_risk_type::text::public.order_risk_type;

DROP TYPE public.order_risk_type_old;

DROP INDEX IF EXISTS public.idx_orders_status_changed_at;

DROP TRIGGER IF EXISTS trigger_set_order_status_changed_at ON public.orders;

DROP FUNCTION IF EXISTS public.set_order_status_changed_at();

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS status_changed_at;
