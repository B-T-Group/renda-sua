ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.brands.approved IS 'Whether the brand is approved for use in the marketplace.';
