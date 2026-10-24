-- Open Democratic Republic of the Congo (CD / RDC) as an export destination.
-- Shoppers can browse export items and submit interest. Local delivery stays off
-- (no delivery configs, time slots, or payment rails).

INSERT INTO public.supported_country_states (
    country_code, country_name, state_name, currency_code,
    service_status, delivery_enabled, launch_date
)
SELECT v.country_code, v.country_name, v.state_name, v.currency_code,
       v.service_status, v.delivery_enabled, v.launch_date
FROM (VALUES
    ('CD', 'Democratic Republic of the Congo', 'Bas-Uélé', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Haut-Katanga', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Haut-Lomami', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Haut-Uélé', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Ituri', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Kasaï', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Kasaï Central', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Kasaï Oriental', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Kinshasa', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Kongo Central', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Kwango', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Kwilu', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Lomami', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Lualaba', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Mai-Ndombe', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Maniema', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Mongala', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Nord-Kivu', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Nord-Ubangi', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Sankuru', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Sud-Kivu', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Sud-Ubangi', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Tanganyika', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Tshopo', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Tshuapa', 'CDF', 'active', false, CURRENT_DATE),
    ('CD', 'Democratic Republic of the Congo', 'Équateur', 'CDF', 'active', false, CURRENT_DATE)
) AS v(country_code, country_name, state_name, currency_code, service_status, delivery_enabled, launch_date)
WHERE NOT EXISTS (
    SELECT 1 FROM public.supported_country_states s
    WHERE s.country_code = v.country_code AND s.state_name = v.state_name
);

INSERT INTO public.country_onboarding_configs (
  country_code, signup_enabled, postal_code_required, verification_flow, default_currency
) VALUES
  ('CD', true, false, 'national_id', 'CDF')
ON CONFLICT (country_code) DO UPDATE
SET signup_enabled = EXCLUDED.signup_enabled,
    postal_code_required = EXCLUDED.postal_code_required,
    verification_flow = EXCLUDED.verification_flow,
    default_currency = EXCLUDED.default_currency,
    updated_at = NOW();

-- Show existing export catalog items in CD. Skip a listing whose home location is already CD.
INSERT INTO public.item_export_markets (item_id, country_code)
SELECT i.id, 'CD'
FROM public.items i
WHERE i.export_available = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.item_export_markets e
    WHERE e.item_id = i.id
      AND e.country_code = 'CD'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.business_inventory bi
    JOIN public.business_locations bl ON bl.id = bi.business_location_id
    JOIN public.addresses a ON a.id = bl.address_id
    WHERE bi.item_id = i.id
      AND bi.is_active = true
      AND upper(a.country) = 'CD'
  );
