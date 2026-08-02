DROP INDEX IF EXISTS public.idx_orders_acceptance_activates_at;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS acceptance_activates_at;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS future_acceptance_timeout_seconds,
  DROP COLUMN IF EXISTS order_activation_lead_minutes,
  DROP COLUMN IF EXISTS default_estimated_prep_minutes;

-- Note: PostgreSQL cannot remove an enum value ('scheduled') safely in down migrations.
