ALTER TABLE public.stripe_refunds
    DROP COLUMN IF EXISTS refund_type,
    DROP COLUMN IF EXISTS refund_payment_id,
    DROP COLUMN IF EXISTS refund_request_id;

DROP TABLE IF EXISTS public.order_returns;
DROP TABLE IF EXISTS public.order_refund_payments;
DROP TABLE IF EXISTS public.order_refund_evidence;
DROP TABLE IF EXISTS public.order_refund_events;

ALTER TABLE public.order_refund_requests
    DROP COLUMN IF EXISTS sla_due_at,
    DROP COLUMN IF EXISTS reopen_count,
    DROP COLUMN IF EXISTS resolved_by_user_id,
    DROP COLUMN IF EXISTS info_request_message,
    DROP COLUMN IF EXISTS return_status,
    DROP COLUMN IF EXISTS return_required,
    DROP COLUMN IF EXISTS destination,
    DROP COLUMN IF EXISTS payment_source_snapshot,
    DROP COLUMN IF EXISTS currency,
    DROP COLUMN IF EXISTS approved_amount,
    DROP COLUMN IF EXISTS requested_amount,
    DROP COLUMN IF EXISTS resolution_type;

DROP TYPE IF EXISTS stripe_refund_type;
DROP TYPE IF EXISTS return_status;
DROP TYPE IF EXISTS refund_event_actor_type;
DROP TYPE IF EXISTS refund_payment_status;
DROP TYPE IF EXISTS refund_destination;
