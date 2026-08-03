-- System cancellation reasons for daily order cleanup cron
INSERT INTO public.order_cancellation_reasons (id, value, display, rank, persona)
VALUES
  (
    20,
    'payment_not_completed',
    'Payment not completed in time',
    19,
    ARRAY['system']
  ),
  (
    21,
    'not_picked_up_in_time',
    'Order was not picked up in time',
    20,
    ARRAY['system']
  )
ON CONFLICT (id) DO NOTHING;

-- Delivery failure reason for missed delivery windows / stuck mid-fulfillment
INSERT INTO public.delivery_failure_reasons (reason_key, reason_en, reason_fr, sort_order)
SELECT
  'delivery_window_missed',
  'Delivery window missed',
  'Créneau de livraison dépassé',
  8
WHERE NOT EXISTS (
  SELECT 1
  FROM public.delivery_failure_reasons
  WHERE reason_key = 'delivery_window_missed'
);
