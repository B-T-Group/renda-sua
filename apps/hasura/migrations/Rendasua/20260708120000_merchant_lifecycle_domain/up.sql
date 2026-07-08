-- Merchant lifecycle domain: enums, payment accounts, status history, lifecycle columns

CREATE TYPE public.business_lifecycle_status_enum AS ENUM (
  'created',
  'catalog_ready',
  'payment_setup_pending',
  'payment_verification_pending',
  'active',
  'suspended'
);

CREATE TYPE public.business_payment_capability_status_enum AS ENUM (
  'not_started',
  'in_progress',
  'verification_pending',
  'verified',
  'rejected'
);

CREATE TYPE public.business_payment_provider_enum AS ENUM (
  'stripe',
  'mobile_money',
  'paypal',
  'bank_transfer'
);

CREATE TABLE public.business_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  provider public.business_payment_provider_enum NOT NULL,
  capability_status public.business_payment_capability_status_enum NOT NULL DEFAULT 'not_started',
  external_reference TEXT,
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_payment_accounts_business_provider UNIQUE (business_id, provider)
);

CREATE INDEX idx_business_payment_accounts_business_id
  ON public.business_payment_accounts(business_id);
CREATE INDEX idx_business_payment_accounts_capability_status
  ON public.business_payment_accounts(capability_status);

CREATE TRIGGER set_public_business_payment_accounts_updated_at
  BEFORE UPDATE ON public.business_payment_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.business_lifecycle_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  from_status public.business_lifecycle_status_enum,
  to_status public.business_lifecycle_status_enum NOT NULL,
  reason TEXT,
  changed_by_type VARCHAR(20) NOT NULL DEFAULT 'system'
    CHECK (changed_by_type IN ('system', 'admin')),
  changed_by_user_id UUID REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_lifecycle_status_history_business_id
  ON public.business_lifecycle_status_history(business_id);
CREATE INDEX idx_business_lifecycle_status_history_created_at
  ON public.business_lifecycle_status_history(created_at);

ALTER TABLE public.businesses
  ADD COLUMN lifecycle_status public.business_lifecycle_status_enum NOT NULL DEFAULT 'created';

-- Seed payment accounts from existing Stripe Connect rows
INSERT INTO public.business_payment_accounts (
  business_id,
  provider,
  capability_status,
  external_reference,
  rejection_reason,
  verified_at,
  created_at,
  updated_at
)
SELECT
  b.id,
  'stripe'::public.business_payment_provider_enum,
  CASE
    WHEN sca.charges_enabled AND sca.payouts_enabled THEN 'verified'::public.business_payment_capability_status_enum
    WHEN sca.disabled_reason IS NOT NULL THEN 'rejected'::public.business_payment_capability_status_enum
    WHEN sca.details_submitted THEN 'verification_pending'::public.business_payment_capability_status_enum
    WHEN sca.stripe_account_id IS NOT NULL THEN 'in_progress'::public.business_payment_capability_status_enum
    ELSE 'not_started'::public.business_payment_capability_status_enum
  END,
  sca.stripe_account_id,
  sca.disabled_reason,
  CASE
    WHEN sca.charges_enabled AND sca.payouts_enabled THEN sca.updated_at
    ELSE NULL
  END,
  sca.created_at,
  sca.updated_at
FROM public.stripe_connect_accounts sca
JOIN public.businesses b ON b.user_id = sca.user_id
ON CONFLICT (business_id, provider) DO NOTHING;

-- Seed mobile_money verified accounts for admin-verified businesses without stripe
INSERT INTO public.business_payment_accounts (
  business_id,
  provider,
  capability_status,
  verified_at
)
SELECT
  b.id,
  'mobile_money'::public.business_payment_provider_enum,
  'verified'::public.business_payment_capability_status_enum,
  b.updated_at
FROM public.businesses b
WHERE b.is_verified = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.business_payment_accounts bpa
    WHERE bpa.business_id = b.id AND bpa.provider = 'stripe'
  )
ON CONFLICT (business_id, provider) DO NOTHING;

-- Backfill lifecycle_status
UPDATE public.businesses b
SET lifecycle_status = 'active'
WHERE b.is_verified = TRUE;

UPDATE public.businesses b
SET lifecycle_status = 'payment_verification_pending'
WHERE b.lifecycle_status = 'created'
  AND EXISTS (
    SELECT 1 FROM public.business_payment_accounts bpa
    WHERE bpa.business_id = b.id
      AND bpa.capability_status IN ('verification_pending', 'rejected')
  )
  AND b.merchant_agreement_version IS NOT NULL
  AND b.merchant_agreement_accepted_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.business_locations bl
    WHERE bl.business_id = b.id AND bl.is_active = TRUE
  )
  AND EXISTS (
    SELECT 1 FROM public.items i
    JOIN public.business_inventory bi ON bi.item_id = i.id
    JOIN public.business_locations bl ON bl.id = bi.business_location_id
    WHERE i.business_id = b.id
      AND i.is_active = TRUE
      AND i.status = 'active'::public.item_status_enum
      AND bi.is_active = TRUE
      AND bi.quantity > 0
      AND bl.is_active = TRUE
  );

UPDATE public.businesses b
SET lifecycle_status = 'payment_setup_pending'
WHERE b.lifecycle_status = 'created'
  AND b.merchant_agreement_version IS NOT NULL
  AND b.merchant_agreement_accepted_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.business_locations bl
    WHERE bl.business_id = b.id AND bl.is_active = TRUE
  )
  AND EXISTS (
    SELECT 1 FROM public.items i
    JOIN public.business_inventory bi ON bi.item_id = i.id
    JOIN public.business_locations bl ON bl.id = bi.business_location_id
    WHERE i.business_id = b.id
      AND i.is_active = TRUE
      AND i.status = 'active'::public.item_status_enum
      AND bi.is_active = TRUE
      AND bi.quantity > 0
      AND bl.is_active = TRUE
  );

UPDATE public.businesses b
SET lifecycle_status = 'catalog_ready'
WHERE b.lifecycle_status = 'created'
  AND b.merchant_agreement_version IS NOT NULL
  AND b.merchant_agreement_accepted_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.business_locations bl
    WHERE bl.business_id = b.id AND bl.is_active = TRUE
  )
  AND EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.business_id = b.id
      AND i.is_active = TRUE
      AND i.status = 'active'::public.item_status_enum
  );

-- Replace is_verified with generated column (backward-compatible alias)
ALTER TABLE public.businesses DROP COLUMN is_verified;

ALTER TABLE public.businesses
  ADD COLUMN is_storefront_visible BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status NOT IN ('created', 'suspended')
  ) STORED;

ALTER TABLE public.businesses
  ADD COLUMN can_accept_orders BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status = 'active'
  ) STORED;

ALTER TABLE public.businesses
  ADD COLUMN is_verified BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status = 'active'
  ) STORED;
