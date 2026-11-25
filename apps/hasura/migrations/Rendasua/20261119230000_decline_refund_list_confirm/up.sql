-- First provable-empty FedaPay list, unknown-lookup streak, and the last support notice.
ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS refund_list_empty_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_unknown_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_unknown_notice_at timestamptz;

COMMENT ON COLUMN public.rental_bookings.refund_list_empty_at IS
  'When the first provable-empty FedaPay list was seen after the send marker was older than the lag window. A second empty at least the confirm gap later is absence.';

COMMENT ON COLUMN public.rental_bookings.refund_unknown_streak IS
  'Consecutive FedaPay lookups that were not a definitive match or a confirmed absence. Reset when a payout is found.';

COMMENT ON COLUMN public.rental_bookings.refund_unknown_notice_at IS
  'When support was last told that this row has an unknown FedaPay lookup streak. At most once per 24 hours.';

INSERT INTO public.application_configurations
  (config_key, config_name, description, data_type, boolean_value, number_value, min_value, max_value,
   country_code, tags, status, version)
SELECT v.k, v.n, v.d, 'number', NULL, v.num, v.mn, v.mx, NULL, ARRAY['rentals', 'feature-flag']::text[], 'active', 1
FROM (VALUES
  ('rentals_fedapay_list_lag_minutes', 'FedaPay list lag window',
   'Minutes after the send marker before an empty FedaPay payout list can count toward absence. Default 10.',
   10, 1, 120),
  ('rentals_fedapay_list_confirm_minutes', 'FedaPay empty-list confirm gap',
   'Minutes between two provable-empty FedaPay lists before the payout is treated as absent. Default 10.',
   10, 1, 120),
  ('rentals_fedapay_unknown_notice_after', 'FedaPay unknown-lookup notice',
   'Consecutive unknown FedaPay lookups before support gets one manual-check notice. Default 10.',
   10, 1, 100)
) AS v(k, n, d, num, mn, mx)
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations c
  WHERE c.config_key = v.k AND c.country_code IS NULL
);
