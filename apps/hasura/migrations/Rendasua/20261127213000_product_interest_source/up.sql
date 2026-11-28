-- Where an export interest came from. 'in_app' is the existing destination-market flow;
-- 'public_export_catalog' is a partner inquiry sent from the public /exports/{cc} page
-- (any market may send it, it never opens an export order).

ALTER TABLE public.product_interest_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'in_app';

ALTER TABLE public.product_interest_requests
  DROP CONSTRAINT IF EXISTS product_interest_requests_source_check;

ALTER TABLE public.product_interest_requests
  ADD CONSTRAINT product_interest_requests_source_check
  CHECK (source = ANY (ARRAY['in_app'::text, 'public_export_catalog'::text]));

COMMENT ON COLUMN public.product_interest_requests.source IS
  'in_app: shopper in a destination market. public_export_catalog: partner inquiry from the public /exports/{cc} page.';
