-- Add users.country (ISO 3166-1 alpha-2) as the canonical market/rail source.
-- Backfill per user, first match wins:
--   1. primary active business location address (business owner)
--   2. business_addresses
--   3. client_addresses
--   4. agent_addresses
-- Within each source, prefer primary rows; only active addresses are considered.

ALTER TABLE public.users ADD COLUMN country TEXT;

COMMENT ON COLUMN public.users.country IS
  'ISO 3166-1 alpha-2 country code. Canonical source for market/payment-rail resolution. Set at signup, backfilled from addresses.';

WITH candidates AS (
  SELECT
    b.user_id,
    UPPER(TRIM(a.country)) AS country,
    1 AS source_rank,
    COALESCE(bl.is_primary, FALSE) AS is_primary,
    bl.created_at
  FROM public.business_locations bl
  JOIN public.businesses b ON b.id = bl.business_id
  JOIN public.addresses a ON a.id = bl.address_id
  WHERE bl.is_active = TRUE
    AND a.status = 'active'
    AND NULLIF(TRIM(a.country), '') IS NOT NULL

  UNION ALL

  SELECT
    b.user_id,
    UPPER(TRIM(a.country)),
    2,
    COALESCE(a.is_primary, FALSE),
    ba.created_at
  FROM public.business_addresses ba
  JOIN public.businesses b ON b.id = ba.business_id
  JOIN public.addresses a ON a.id = ba.address_id
  WHERE a.status = 'active'
    AND NULLIF(TRIM(a.country), '') IS NOT NULL

  UNION ALL

  SELECT
    c.user_id,
    UPPER(TRIM(a.country)),
    3,
    COALESCE(a.is_primary, FALSE),
    ca.created_at
  FROM public.client_addresses ca
  JOIN public.clients c ON c.id = ca.client_id
  JOIN public.addresses a ON a.id = ca.address_id
  WHERE a.status = 'active'
    AND NULLIF(TRIM(a.country), '') IS NOT NULL

  UNION ALL

  SELECT
    ag.user_id,
    UPPER(TRIM(a.country)),
    4,
    COALESCE(a.is_primary, FALSE),
    aa.created_at
  FROM public.agent_addresses aa
  JOIN public.agents ag ON ag.id = aa.agent_id
  JOIN public.addresses a ON a.id = aa.address_id
  WHERE a.status = 'active'
    AND NULLIF(TRIM(a.country), '') IS NOT NULL
),
ranked AS (
  SELECT
    user_id,
    country,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY source_rank ASC, is_primary DESC, created_at ASC
    ) AS rn
  FROM candidates
)
UPDATE public.users u
SET country = ranked.country
FROM ranked
WHERE ranked.user_id = u.id
  AND ranked.rn = 1
  AND u.country IS NULL;
