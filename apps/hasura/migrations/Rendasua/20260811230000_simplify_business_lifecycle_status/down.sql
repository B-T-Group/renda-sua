-- Best-effort revert: restore the 6-value enum. Businesses that were collapsed
-- into contract_signed are mapped back to catalog_ready (the intermediate
-- distinctions cannot be recovered).

ALTER TABLE public.businesses DROP COLUMN can_accept_orders;
ALTER TABLE public.businesses DROP COLUMN is_verified;

ALTER TYPE public.business_lifecycle_status_enum
  RENAME TO business_lifecycle_status_enum_new;

CREATE TYPE public.business_lifecycle_status_enum AS ENUM (
  'created',
  'catalog_ready',
  'payment_setup_pending',
  'payment_verification_pending',
  'active',
  'suspended'
);

ALTER TABLE public.businesses
  ALTER COLUMN lifecycle_status DROP DEFAULT,
  ALTER COLUMN lifecycle_status TYPE public.business_lifecycle_status_enum
    USING (
      CASE lifecycle_status::text
        WHEN 'contract_signed' THEN 'catalog_ready'
        ELSE lifecycle_status::text
      END
    )::public.business_lifecycle_status_enum,
  ALTER COLUMN lifecycle_status SET DEFAULT 'created';

ALTER TABLE public.business_lifecycle_status_history
  ALTER COLUMN from_status TYPE public.business_lifecycle_status_enum
    USING (
      CASE from_status::text
        WHEN 'contract_signed' THEN 'catalog_ready'
        ELSE from_status::text
      END
    )::public.business_lifecycle_status_enum,
  ALTER COLUMN to_status TYPE public.business_lifecycle_status_enum
    USING (
      CASE to_status::text
        WHEN 'contract_signed' THEN 'catalog_ready'
        ELSE to_status::text
      END
    )::public.business_lifecycle_status_enum;

DROP TYPE public.business_lifecycle_status_enum_new;

ALTER TABLE public.businesses
  ADD COLUMN can_accept_orders BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status = 'active'
  ) STORED;

ALTER TABLE public.businesses
  ADD COLUMN is_verified BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status = 'active'
  ) STORED;

COMMENT ON COLUMN public.businesses.is_storefront_visible IS
  'Catalog visibility. Stripe: agreement signed; mobile money: lifecycle active. Maintained by MerchantLifecycleService.';
