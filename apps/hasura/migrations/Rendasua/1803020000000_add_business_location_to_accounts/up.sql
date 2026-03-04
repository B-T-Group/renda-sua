-- Add business_location_id to accounts for per-location business accounts
ALTER TABLE public.accounts
  ADD COLUMN business_location_id UUID NULL REFERENCES public.business_locations(id) ON DELETE SET NULL;

-- Drop existing unique index
DROP INDEX IF EXISTS public.idx_accounts_user_currency;

-- Partial unique index: one account per (user_id, currency) when no business_location
CREATE UNIQUE INDEX idx_accounts_user_currency_legacy ON public.accounts(user_id, currency)
  WHERE business_location_id IS NULL;

-- Partial unique index: one account per (user_id, currency, business_location_id) when location-scoped
CREATE UNIQUE INDEX idx_accounts_user_currency_location ON public.accounts(user_id, currency, business_location_id)
  WHERE business_location_id IS NOT NULL;

-- Index for lookups by business_location_id
CREATE INDEX idx_accounts_business_location ON public.accounts(business_location_id);

COMMENT ON COLUMN public.accounts.business_location_id IS 'When set, this account belongs to a business location. NULL for legacy/personal accounts.';
