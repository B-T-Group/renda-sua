INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  string_value,
  country_code,
  status,
  version,
  tags,
  allowed_values
) VALUES (
  'mobile_money_verification_method',
  'Mobile money phone verification method',
  'How merchants and agents verify a mobile money payout number. "question" asks the user to confirm the number receives MoMo; "transaction" charges a small refundable amount.',
  'string',
  'question',
  NULL,
  'active',
  1,
  ARRAY['mobile_money','verification','phones'],
  ARRAY['question','transaction']
);
