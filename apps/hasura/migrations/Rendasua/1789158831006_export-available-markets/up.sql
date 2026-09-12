-- Rename interest_only → export_available and add per-item export markets.

ALTER TABLE public.items
  RENAME COLUMN interest_only TO export_available;

COMMENT ON COLUMN public.items.export_available IS
  'When true, shoppers cannot buy; they submit export interest. Visible in selected markets via item_export_markets. Listed at a single home business_inventory location.';

CREATE TABLE IF NOT EXISTS public.item_export_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_export_markets_item_country_unique UNIQUE (item_id, country_code),
  CONSTRAINT item_export_markets_country_code_check
    CHECK (char_length(country_code) = 2)
);

CREATE INDEX IF NOT EXISTS item_export_markets_country_code_idx
  ON public.item_export_markets (country_code);

CREATE INDEX IF NOT EXISTS item_export_markets_item_id_idx
  ON public.item_export_markets (item_id);

COMMENT ON TABLE public.item_export_markets IS
  'Markets (ISO-2 country codes) where an export_available item should appear in the destination catalog (section + search). Home market is implied by business_inventory location.';

UPDATE public.message_types
SET comment = 'Client interest lead for export_available catalog items'
WHERE id = 'PRODUCT_INTEREST';
