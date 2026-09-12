DROP TABLE IF EXISTS public.item_export_markets;

ALTER TABLE public.items
  RENAME COLUMN export_available TO interest_only;

COMMENT ON COLUMN public.items.interest_only IS
  'When true, shoppers cannot buy; they submit interest and the business follows up externally. Prices are hidden from shoppers.';

UPDATE public.message_types
SET comment = 'Client interest lead for interest_only catalog items'
WHERE id = 'PRODUCT_INTEREST';
