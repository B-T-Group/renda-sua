ALTER TABLE public.product_interest_requests
  DROP CONSTRAINT IF EXISTS product_interest_requests_source_check;

ALTER TABLE public.product_interest_requests
  DROP COLUMN IF EXISTS source;
