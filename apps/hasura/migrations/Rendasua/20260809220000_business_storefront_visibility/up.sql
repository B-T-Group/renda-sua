-- Re-introduce is_storefront_visible as a plain (non-generated) column.
-- Visibility is rail-dependent and maintained by MerchantLifecycleService:
--   Stripe: agreement signed (lifecycle not created/suspended)
--   Mobile money: lifecycle active (agreement + approved ID)
-- can_accept_orders remains generated from lifecycle_status = 'active'.
--
-- Backfill mirrors PaymentRoutingService.resolveRailForCountry defaults:
-- Stripe rail = country in STRIPE_ENABLED_COUNTRIES default (CA,US)
-- AND an active stripe row in supported_payment_systems.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_storefront_visible BOOLEAN NOT NULL DEFAULT false;

-- Active merchants are always visible (both rails).
UPDATE public.businesses
SET is_storefront_visible = true
WHERE lifecycle_status = 'active';

-- Intermediate statuses are visible only on the Stripe rail
-- (default enabled countries CA,US + active stripe SPS row).
WITH primary_loc AS (
  SELECT DISTINCT ON (bl.business_id)
    bl.business_id,
    UPPER(TRIM(a.country)) AS country
  FROM public.business_locations bl
  JOIN public.addresses a ON a.id = bl.address_id
  WHERE bl.is_active = true
  ORDER BY bl.business_id, bl.is_primary DESC NULLS LAST, bl.created_at ASC
)
UPDATE public.businesses b
SET is_storefront_visible = true
FROM primary_loc pl
WHERE b.id = pl.business_id
  AND b.lifecycle_status IN (
    'catalog_ready',
    'payment_setup_pending',
    'payment_verification_pending'
  )
  AND pl.country IN ('CA', 'US')
  AND EXISTS (
    SELECT 1
    FROM public.supported_payment_systems sps
    WHERE sps.name = 'stripe'
      AND sps.active = true
      AND UPPER(TRIM(sps.country)) = pl.country
  );

COMMENT ON COLUMN public.businesses.is_storefront_visible IS
  'Catalog visibility. Stripe: agreement signed; mobile money: lifecycle active. Maintained by MerchantLifecycleService.';
