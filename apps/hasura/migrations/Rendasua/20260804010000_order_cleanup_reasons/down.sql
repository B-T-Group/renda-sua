DELETE FROM public.delivery_failure_reasons
WHERE reason_key = 'delivery_window_missed';

DELETE FROM public.order_cancellation_reasons
WHERE id IN (20, 21);
