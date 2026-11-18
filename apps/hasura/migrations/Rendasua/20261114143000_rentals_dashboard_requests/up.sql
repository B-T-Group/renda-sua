-- Business home rental requests and the 24h auto-decline.
-- The flag inserts false. Dev is turned on by hand. Production stays off.
-- Do not enable this from a workflow.

INSERT INTO public.message_types (id, comment)
VALUES
  (
    'RENTAL_REQUEST_NO_RESPONSE',
    'The business did not answer a rental request before the response deadline.'
  ),
  (
    'RENTAL_REQUEST_EXPIRED',
    'A rental request expired because the business did not answer in time.'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_dashboard_requests_enabled',
  'Dashboard rental requests',
  'Shows pending rental requests on the business home and auto-declines them after 24 hours or at the start, whichever is sooner. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_dashboard_requests_enabled' AND country_code IS NULL
);
