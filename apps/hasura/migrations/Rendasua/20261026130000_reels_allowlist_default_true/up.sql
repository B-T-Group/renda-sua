-- New businesses are allowed to use reels by default. Existing rows were
-- backfilled to true in prod and DEV (2026-10-26); this prevents new signups
-- from hitting "Merchant is not allowlisted for reels".
ALTER TABLE public.businesses
  ALTER COLUMN reels_enabled_allowlist SET DEFAULT true;
