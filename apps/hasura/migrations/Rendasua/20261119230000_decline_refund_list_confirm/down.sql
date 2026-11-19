DELETE FROM public.application_configurations
WHERE country_code IS NULL
  AND config_key IN (
    'rentals_fedapay_list_lag_minutes',
    'rentals_fedapay_list_confirm_minutes',
    'rentals_fedapay_unknown_notice_after'
  );

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS refund_unknown_notice_at,
  DROP COLUMN IF EXISTS refund_unknown_streak,
  DROP COLUMN IF EXISTS refund_list_empty_at;
