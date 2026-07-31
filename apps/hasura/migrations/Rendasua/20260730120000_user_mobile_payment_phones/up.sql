-- User mobile payment phone registry + location/agent FKs + phone_verification entity

CREATE TABLE public.user_mobile_payment_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  last_verification_transaction_id UUID REFERENCES public.mobile_payment_transactions(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_mobile_payment_phones_user_phone UNIQUE (user_id, phone_e164)
);

CREATE INDEX idx_user_mobile_payment_phones_user_id
  ON public.user_mobile_payment_phones(user_id);

CREATE INDEX idx_user_mobile_payment_phones_is_verified
  ON public.user_mobile_payment_phones(is_verified);

CREATE TRIGGER set_public_user_mobile_payment_phones_updated_at
  BEFORE UPDATE ON public.user_mobile_payment_phones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.business_locations
  ADD COLUMN mobile_payment_phone_id UUID REFERENCES public.user_mobile_payment_phones(id) ON UPDATE RESTRICT ON DELETE SET NULL;

CREATE INDEX idx_business_locations_mobile_payment_phone_id
  ON public.business_locations(mobile_payment_phone_id);

ALTER TABLE public.agents
  ADD COLUMN mobile_payment_phone_id UUID REFERENCES public.user_mobile_payment_phones(id) ON UPDATE RESTRICT ON DELETE SET NULL;

CREATE INDEX idx_agents_mobile_payment_phone_id
  ON public.agents(mobile_payment_phone_id);

ALTER TYPE payment_entity_type ADD VALUE 'phone_verification';

-- Backfill unverified mobile payment phones for non-Stripe-rail users with location phones.
-- Stripe rail: primary location country has active stripe in supported_payment_systems.
WITH stripe_countries AS (
  SELECT DISTINCT UPPER(TRIM(country::text)) AS country_code
  FROM public.supported_payment_systems
  WHERE name = 'stripe' AND active = TRUE
),
business_location_rows AS (
  SELECT DISTINCT ON (b.user_id, normalized.phone_e164)
    b.user_id,
    normalized.phone_e164,
    bl.id AS location_id
  FROM public.business_locations bl
  JOIN public.businesses b ON b.id = bl.business_id
  JOIN public.addresses a ON a.id = bl.address_id
  LEFT JOIN stripe_countries sc ON sc.country_code = UPPER(TRIM(a.country::text))
  CROSS JOIN LATERAL (
    SELECT regexp_replace(trim(bl.phone), '[^0-9+]', '', 'g') AS raw_phone
  ) raw
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN raw.raw_phone ~ '^\+' THEN raw.raw_phone
      WHEN raw.raw_phone ~ '^237' THEN '+' || raw.raw_phone
      WHEN raw.raw_phone ~ '^241' THEN '+' || raw.raw_phone
      WHEN length(raw.raw_phone) >= 9 THEN '+237' || raw.raw_phone
      ELSE NULL
    END AS phone_e164
  ) normalized
  WHERE bl.phone IS NOT NULL
    AND trim(bl.phone) <> ''
    AND normalized.phone_e164 IS NOT NULL
    AND sc.country_code IS NULL
  ORDER BY b.user_id, normalized.phone_e164, bl.is_primary DESC, bl.created_at ASC
),
inserted_phones AS (
  INSERT INTO public.user_mobile_payment_phones (user_id, phone_e164, is_verified)
  SELECT user_id, phone_e164, FALSE
  FROM business_location_rows
  ON CONFLICT (user_id, phone_e164) DO NOTHING
  RETURNING id, user_id, phone_e164
),
all_phones AS (
  SELECT id, user_id, phone_e164 FROM inserted_phones
  UNION
  SELECT p.id, p.user_id, p.phone_e164
  FROM public.user_mobile_payment_phones p
  JOIN business_location_rows blr
    ON blr.user_id = p.user_id AND blr.phone_e164 = p.phone_e164
)
UPDATE public.business_locations bl
SET mobile_payment_phone_id = ap.id
FROM business_location_rows blr
JOIN all_phones ap ON ap.user_id = blr.user_id AND ap.phone_e164 = blr.phone_e164
WHERE bl.id = blr.location_id
  AND bl.mobile_payment_phone_id IS NULL;

-- Backfill agents on non-Stripe rail with users.phone_number
WITH stripe_countries AS (
  SELECT DISTINCT UPPER(TRIM(country::text)) AS country_code
  FROM public.supported_payment_systems
  WHERE name = 'stripe' AND active = TRUE
),
agent_rows AS (
  SELECT DISTINCT ON (a.user_id)
    a.id AS agent_id,
    a.user_id,
    normalized.phone_e164
  FROM public.agents a
  JOIN public.users u ON u.id = a.user_id
  LEFT JOIN public.agent_addresses aa ON aa.agent_id = a.id
  LEFT JOIN public.addresses addr ON addr.id = aa.address_id AND addr.status = 'active'
  LEFT JOIN stripe_countries sc ON sc.country_code = UPPER(TRIM(addr.country::text))
  CROSS JOIN LATERAL (
    SELECT regexp_replace(trim(u.phone_number), '[^0-9+]', '', 'g') AS raw_phone
  ) raw
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN raw.raw_phone ~ '^\+' THEN raw.raw_phone
      WHEN raw.raw_phone ~ '^237' THEN '+' || raw.raw_phone
      WHEN raw.raw_phone ~ '^241' THEN '+' || raw.raw_phone
      WHEN length(raw.raw_phone) >= 9 THEN '+237' || raw.raw_phone
      ELSE NULL
    END AS phone_e164
  ) normalized
  WHERE u.phone_number IS NOT NULL
    AND trim(u.phone_number) <> ''
    AND normalized.phone_e164 IS NOT NULL
    AND sc.country_code IS NULL
  ORDER BY a.user_id, aa.is_primary DESC NULLS LAST, aa.created_at ASC NULLS LAST
),
inserted_agent_phones AS (
  INSERT INTO public.user_mobile_payment_phones (user_id, phone_e164, is_verified)
  SELECT user_id, phone_e164, FALSE
  FROM agent_rows
  ON CONFLICT (user_id, phone_e164) DO NOTHING
  RETURNING id, user_id, phone_e164
),
all_agent_phones AS (
  SELECT id, user_id, phone_e164 FROM inserted_agent_phones
  UNION
  SELECT p.id, p.user_id, p.phone_e164
  FROM public.user_mobile_payment_phones p
  JOIN agent_rows ar ON ar.user_id = p.user_id AND ar.phone_e164 = p.phone_e164
)
UPDATE public.agents a
SET mobile_payment_phone_id = ap.id
FROM agent_rows ar
JOIN all_agent_phones ap ON ap.user_id = ar.user_id AND ap.phone_e164 = ar.phone_e164
WHERE a.id = ar.agent_id
  AND a.mobile_payment_phone_id IS NULL;
