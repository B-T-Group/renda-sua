DELETE FROM public.order_cancellation_reasons WHERE id IN (22, 23, 24);

DROP TABLE IF EXISTS public.failed_pickups;
DROP TYPE IF EXISTS public.failed_pickup_status_enum;
DROP TABLE IF EXISTS public.pickup_failure_reasons;
