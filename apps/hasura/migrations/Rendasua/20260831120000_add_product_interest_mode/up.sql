-- Product interest mode: pricing not applicable; client manifests interest.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS interest_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.items.interest_only IS
  'When true, shoppers cannot buy; they submit interest and the business follows up externally. Prices are hidden from shoppers.';

CREATE TABLE IF NOT EXISTS public.product_interest_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  business_inventory_id uuid NOT NULL REFERENCES public.business_inventory(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  business_location_id uuid NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
  client_note text NULL,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_interest_requests_status_check
    CHECK (status = ANY (ARRAY['submitted'::text]))
);

CREATE INDEX IF NOT EXISTS product_interest_requests_business_id_created_at_idx
  ON public.product_interest_requests (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_interest_requests_client_user_id_created_at_idx
  ON public.product_interest_requests (client_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_interest_requests_inventory_id_idx
  ON public.product_interest_requests (business_inventory_id);

COMMENT ON TABLE public.product_interest_requests IS
  'Client interest leads for interest_only catalog items; business follows up outside the app.';

INSERT INTO public.message_types (id, comment)
VALUES ('PRODUCT_INTEREST', 'Client interest lead for interest_only catalog items')
ON CONFLICT (id) DO NOTHING;
