-- Diaspora checkout: the person who pays (payer, abroad) and the person who
-- receives the order locally (recipient) can be different people. The recipient
-- is intentionally not a users/clients row so they never need an account.
-- All columns are additive and nullable/defaulted: existing orders keep today's
-- semantics, where the recipient is the payer.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS recipient_notify_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_third_party_recipient boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS payer_phone text,
  ADD COLUMN IF NOT EXISTS payer_email text,
  ADD COLUMN IF NOT EXISTS payer_country varchar(2),
  ADD COLUMN IF NOT EXISTS payer_payment_rail text,
  ADD COLUMN IF NOT EXISTS fulfillment_country varchar(2),
  ADD COLUMN IF NOT EXISTS is_diaspora_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS presentment_currency varchar(3),
  ADD COLUMN IF NOT EXISTS presentment_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS presentment_fx_rate numeric(18, 8),
  ADD COLUMN IF NOT EXISTS presentment_fx_source text;

COMMENT ON COLUMN public.orders.recipient_name IS
  'Name of the person receiving the order locally. Null when the recipient is the payer.';
COMMENT ON COLUMN public.orders.recipient_phone IS
  'E.164 phone of the local recipient. Used for SMS/WhatsApp updates and the delivery PIN without a payer login.';
COMMENT ON COLUMN public.orders.is_third_party_recipient IS
  'True when the recipient is someone other than the paying client.';
COMMENT ON COLUMN public.orders.payer_country IS
  'ISO 3166-1 alpha-2 billing country of the payer, kept separate from fulfillment_country.';
COMMENT ON COLUMN public.orders.payer_payment_rail IS
  'Rail used to collect from the payer: stripe | mobile_money | wallet.';
COMMENT ON COLUMN public.orders.is_diaspora_order IS
  'True when the payer paid from a Stripe country while fulfillment happens in a mobile-money country.';
COMMENT ON COLUMN public.orders.presentment_amount IS
  'Indicative amount shown to the payer in their own currency. Display only; settlement always uses orders.currency.';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_third_party_recipient_contact_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_third_party_recipient_contact_check
  CHECK (
    is_third_party_recipient = false
    OR (
      recipient_name IS NOT NULL
      AND btrim(recipient_name) <> ''
      AND recipient_phone IS NOT NULL
      AND btrim(recipient_phone) <> ''
    )
  );

CREATE INDEX IF NOT EXISTS idx_orders_diaspora
  ON public.orders (created_at DESC)
  WHERE is_diaspora_order = true;
