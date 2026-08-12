-- Simplify business_lifecycle_status_enum to 4 values:
--   created, contract_signed, active, suspended
-- The three intermediate statuses (catalog_ready, payment_setup_pending,
-- payment_verification_pending) collapse into contract_signed.

-- Generated columns depend on the enum column: drop and recreate around the swap.
ALTER TABLE public.businesses DROP COLUMN can_accept_orders;
ALTER TABLE public.businesses DROP COLUMN is_verified;

ALTER TYPE public.business_lifecycle_status_enum
  RENAME TO business_lifecycle_status_enum_old;

CREATE TYPE public.business_lifecycle_status_enum AS ENUM (
  'created',
  'contract_signed',
  'active',
  'suspended'
);

ALTER TABLE public.businesses
  ALTER COLUMN lifecycle_status DROP DEFAULT,
  ALTER COLUMN lifecycle_status TYPE public.business_lifecycle_status_enum
    USING (
      CASE lifecycle_status::text
        WHEN 'catalog_ready' THEN 'contract_signed'
        WHEN 'payment_setup_pending' THEN 'contract_signed'
        WHEN 'payment_verification_pending' THEN 'contract_signed'
        ELSE lifecycle_status::text
      END
    )::public.business_lifecycle_status_enum,
  ALTER COLUMN lifecycle_status SET DEFAULT 'created';

ALTER TABLE public.business_lifecycle_status_history
  ALTER COLUMN from_status TYPE public.business_lifecycle_status_enum
    USING (
      CASE from_status::text
        WHEN 'catalog_ready' THEN 'contract_signed'
        WHEN 'payment_setup_pending' THEN 'contract_signed'
        WHEN 'payment_verification_pending' THEN 'contract_signed'
        ELSE from_status::text
      END
    )::public.business_lifecycle_status_enum,
  ALTER COLUMN to_status TYPE public.business_lifecycle_status_enum
    USING (
      CASE to_status::text
        WHEN 'catalog_ready' THEN 'contract_signed'
        WHEN 'payment_setup_pending' THEN 'contract_signed'
        WHEN 'payment_verification_pending' THEN 'contract_signed'
        ELSE to_status::text
      END
    )::public.business_lifecycle_status_enum;

DROP TYPE public.business_lifecycle_status_enum_old;

ALTER TABLE public.businesses
  ADD COLUMN can_accept_orders BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status = 'active'
  ) STORED;

ALTER TABLE public.businesses
  ADD COLUMN is_verified BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status = 'active'
  ) STORED;

-- Storefront visibility is now status-only (no payment-rail dependency).
UPDATE public.businesses
SET is_storefront_visible = (lifecycle_status IN ('contract_signed', 'active'))
WHERE is_storefront_visible IS DISTINCT FROM
  (lifecycle_status IN ('contract_signed', 'active'));

COMMENT ON COLUMN public.businesses.is_storefront_visible IS
  'Catalog visibility: lifecycle_status is contract_signed or active. Maintained by MerchantLifecycleService.';
