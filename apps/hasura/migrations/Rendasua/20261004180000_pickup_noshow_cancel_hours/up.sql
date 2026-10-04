-- Hours a paid pickup must sit in ready_for_pickup before the merchant can
-- cancel it as a client no-show. Country row wins; this global row is the default.

INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    number_value,
    min_value,
    max_value,
    country_code,
    tags,
    status
)
SELECT
    'pickup_noshow_cancel_hours',
    'Pickup no-show cancel hours',
    'Hours a paid pickup order must stay ready before the merchant can cancel it because the client did not collect it. Default 2.',
    'number',
    2,
    0,
    168,
    NULL,
    ARRAY['cancellation', 'order', 'pickup'],
    'active'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.application_configurations
    WHERE config_key = 'pickup_noshow_cancel_hours'
      AND country_code IS NULL
);
