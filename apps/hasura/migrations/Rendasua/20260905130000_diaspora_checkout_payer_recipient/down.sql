DROP INDEX IF EXISTS public.idx_orders_diaspora;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_third_party_recipient_contact_check;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS presentment_fx_source,
  DROP COLUMN IF EXISTS presentment_fx_rate,
  DROP COLUMN IF EXISTS presentment_amount,
  DROP COLUMN IF EXISTS presentment_currency,
  DROP COLUMN IF EXISTS is_diaspora_order,
  DROP COLUMN IF EXISTS fulfillment_country,
  DROP COLUMN IF EXISTS payer_payment_rail,
  DROP COLUMN IF EXISTS payer_country,
  DROP COLUMN IF EXISTS payer_email,
  DROP COLUMN IF EXISTS payer_phone,
  DROP COLUMN IF EXISTS payer_name,
  DROP COLUMN IF EXISTS is_third_party_recipient,
  DROP COLUMN IF EXISTS recipient_notify_whatsapp,
  DROP COLUMN IF EXISTS recipient_email,
  DROP COLUMN IF EXISTS recipient_phone,
  DROP COLUMN IF EXISTS recipient_name;
