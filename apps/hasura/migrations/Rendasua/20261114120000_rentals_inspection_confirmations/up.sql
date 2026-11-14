-- Confirmation screens and the three new inspection notices.
-- The flag inserts false. Dev is turned on by hand. Production stays off.
-- Copy changes for existing notices do not read this flag.

INSERT INTO public.message_types (id, comment)
VALUES
  (
    'RENTAL_STARTED',
    'The renter accepted the condition report and the rental is in progress.'
  ),
  (
    'RENTAL_CONDITION_REPORT_SENT',
    'The business sent a pickup condition report for the renter to review.'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_inspection_confirmations_enabled',
  'Inspected rental confirmations',
  'Confirmation screens and the new rental-started, return-accepted, and report-sent notices. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_inspection_confirmations_enabled' AND country_code IS NULL
);
