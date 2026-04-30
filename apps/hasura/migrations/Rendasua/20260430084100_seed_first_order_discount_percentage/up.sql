INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  number_value,
  country_code,
  status,
  version,
  tags
) VALUES (
  'first_order_discount_percentage',
  'First order referral discount percentage',
  'Percentage discount applied when a valid first-order referral discount code is used.',
  'number',
  5,
  NULL,
  'active',
  1,
  ARRAY['loyalty','discounts','orders']
);

