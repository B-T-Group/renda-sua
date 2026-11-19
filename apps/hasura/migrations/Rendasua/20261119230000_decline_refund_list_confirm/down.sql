-- Only the rows this migration inserted. A tuned value, or a row that already existed, stays.
DELETE FROM public.application_configurations
WHERE country_code IS NULL
  AND version = 1
  AND number_value = 10
  AND (config_key, config_name) IN (
    ('rentals_fedapay_list_lag_minutes', 'FedaPay list lag window'),
    ('rentals_fedapay_list_confirm_minutes', 'FedaPay empty-list confirm gap'),
    ('rentals_fedapay_unknown_notice_after', 'FedaPay unknown-lookup notice')
  );

ALTER TABLE public.rental_bookings
  DROP COLUMN IF EXISTS refund_unknown_notice_at,
  DROP COLUMN IF EXISTS refund_unknown_streak,
  DROP COLUMN IF EXISTS refund_list_empty_at;
