-- Saved recipient contacts for diaspora orders (country-scoped)
CREATE TABLE public.user_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  country TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_recipients_country_check CHECK (country ~ '^[A-Z]{2}$'),
  CONSTRAINT user_recipients_name_check CHECK (char_length(trim(name)) >= 1),
  CONSTRAINT user_recipients_phone_check CHECK (phone ~ '^\+[1-9][0-9]+$')
);

CREATE INDEX user_recipients_user_id_country_idx
  ON public.user_recipients (user_id, country, created_at DESC);

CREATE INDEX user_recipients_user_id_idx
  ON public.user_recipients (user_id);

CREATE TRIGGER set_public_user_recipients_updated_at
  BEFORE UPDATE ON public.user_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

COMMENT ON TABLE public.user_recipients IS
  'Saved recipient contacts for diaspora orders, scoped by fulfillment country';

COMMENT ON COLUMN public.user_recipients.country IS
  'ISO 3166-1 alpha-2 country code of the fulfillment country';

COMMENT ON COLUMN public.user_recipients.phone IS
  'E.164 phone number, validated to match the fulfillment country';
