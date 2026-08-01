DELETE FROM public.order_cancellation_reasons WHERE id = 19 AND value = 'merchant_no_response';

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_reliability_tier_check;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS acceptance_timeout_seconds,
  DROP COLUMN IF EXISTS orders_accepted_count,
  DROP COLUMN IF EXISTS orders_auto_declined_count,
  DROP COLUMN IF EXISTS orders_merchant_cancelled_count,
  DROP COLUMN IF EXISTS acceptance_latency_sum_ms,
  DROP COLUMN IF EXISTS reliability_score,
  DROP COLUMN IF EXISTS reliability_tier,
  DROP COLUMN IF EXISTS accepting_orders,
  DROP COLUMN IF EXISTS paused_until,
  DROP COLUMN IF EXISTS auto_decline_rolling_30d;

DROP INDEX IF EXISTS public.idx_orders_grace_deadline;
DROP INDEX IF EXISTS public.idx_orders_acceptance_deadline;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS acceptance_state,
  DROP COLUMN IF EXISTS acceptance_deadline_at,
  DROP COLUMN IF EXISTS grace_deadline_at,
  DROP COLUMN IF EXISTS accepted_at,
  DROP COLUMN IF EXISTS busy_extra_prep_minutes,
  DROP COLUMN IF EXISTS estimated_prep_minutes;

DROP TYPE IF EXISTS public.order_acceptance_state;
