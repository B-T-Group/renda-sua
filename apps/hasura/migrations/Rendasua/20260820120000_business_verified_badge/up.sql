-- Decouple businesses.is_verified from lifecycle_status.
-- Active = signed contract (can_accept_orders).
-- Verified badge = rail proof: approved ID (MM) or Stripe Connect ready (Stripe).

-- Step A: replace generated is_verified with a writable boolean.
ALTER TABLE public.businesses DROP COLUMN is_verified;

ALTER TABLE public.businesses
  ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.businesses.is_verified IS
  'Verified storefront badge. MM: approved ID; Stripe: Connect charges+payouts enabled. Independent of lifecycle_status.';

-- Step B: activate businesses that match BusinessContractsService.hasValidSignedContract:
--   1) signed BoldSign / contract row, OR
--   2) legacy in-app acceptance only when the country uses in_app (or country unknown).
-- Do NOT activate BoldSign-country merchants from stale merchant_agreement_* alone.
WITH owner_country AS (
  SELECT
    b.id AS business_id,
    UPPER(TRIM(COALESCE(
      u.country,
      (
        SELECT a.country
        FROM public.business_locations bl
        JOIN public.addresses a ON a.id = bl.address_id
        WHERE bl.business_id = b.id
          AND bl.is_active = TRUE
        ORDER BY bl.is_primary DESC NULLS LAST, bl.created_at ASC
        LIMIT 1
      )
    ))) AS country
  FROM public.businesses b
  JOIN public.users u ON u.id = b.user_id
),
in_app_country AS (
  SELECT UPPER(TRIM(ac.country_code)) AS country
  FROM public.application_configurations ac
  WHERE ac.config_key = 'merchant_agreement_provider'
    AND ac.status = 'active'
    AND LOWER(TRIM(ac.string_value)) = 'in_app'
)
UPDATE public.businesses b
SET lifecycle_status = 'active'
FROM owner_country oc
WHERE b.id = oc.business_id
  AND b.lifecycle_status IS DISTINCT FROM 'suspended'
  AND (
    EXISTS (
      SELECT 1
      FROM public.business_contracts c
      JOIN public.contract_templates t ON t.id = c.contract_template_id
      WHERE c.business_id = b.id
        AND c.status = 'signed'
        AND c.invalidated_at IS NULL
        AND (
          t.is_legacy = TRUE
          OR (t.is_active = TRUE AND t.is_legacy = FALSE)
        )
    )
    OR (
      b.merchant_agreement_accepted_at IS NOT NULL
      AND b.merchant_agreement_version IS NOT NULL
      AND (
        oc.country IS NULL
        OR EXISTS (
          SELECT 1 FROM in_app_country iac WHERE iac.country = oc.country
        )
      )
    )
  );

-- Catalog visibility for active (and legacy contract_signed) merchants.
UPDATE public.businesses
SET is_storefront_visible = TRUE
WHERE lifecycle_status IN ('contract_signed', 'active')
  AND is_storefront_visible IS DISTINCT FROM TRUE;

-- Step C: set verified badge from rail-specific proof.
-- Rail mirrors PaymentRoutingService: owner users.country (fallback primary
-- location address) with active stripe in supported_payment_systems for CA/US
-- defaults; otherwise mobile money.
WITH owner_country AS (
  SELECT
    b.id AS business_id,
    b.user_id,
    UPPER(TRIM(COALESCE(
      u.country,
      (
        SELECT a.country
        FROM public.business_locations bl
        JOIN public.addresses a ON a.id = bl.address_id
        WHERE bl.business_id = b.id
          AND bl.is_active = TRUE
        ORDER BY bl.is_primary DESC NULLS LAST, bl.created_at ASC
        LIMIT 1
      )
    ))) AS country
  FROM public.businesses b
  JOIN public.users u ON u.id = b.user_id
),
rail AS (
  SELECT
    oc.business_id,
    oc.user_id,
    CASE
      WHEN oc.country IN ('CA', 'US')
        AND EXISTS (
          SELECT 1
          FROM public.supported_payment_systems sps
          WHERE sps.name = 'stripe'
            AND sps.active = TRUE
            AND UPPER(TRIM(sps.country)) = oc.country
        )
      THEN 'stripe'
      ELSE 'mobile_money'
    END AS payment_rail
  FROM owner_country oc
)
UPDATE public.businesses b
SET is_verified = TRUE
FROM rail r
WHERE b.id = r.business_id
  AND (
    (
      r.payment_rail = 'stripe'
      AND EXISTS (
        SELECT 1
        FROM public.stripe_connect_accounts sca
        WHERE sca.user_id = r.user_id
          AND sca.charges_enabled = TRUE
          AND sca.payouts_enabled = TRUE
      )
    )
    OR (
      r.payment_rail = 'mobile_money'
      AND EXISTS (
        SELECT 1
        FROM public.user_uploads uu
        JOIN public.document_types dt ON dt.id = uu.document_type_id
        WHERE uu.user_id = r.user_id
          AND uu.is_approved = TRUE
          AND dt.name IN ('id_card', 'passport', 'driver_license')
      )
    )
  );

COMMENT ON COLUMN public.businesses.is_storefront_visible IS
  'Catalog visibility: lifecycle_status is contract_signed or active. Maintained by MerchantLifecycleService.';
