-- Allow draft catalog items without a price. Price is required at publish time
-- in the API (quick-publish / publish), not at insert.
ALTER TABLE public.items
  ALTER COLUMN price DROP NOT NULL;

COMMENT ON COLUMN public.items.price IS
  'Catalog price. Nullable for drafts; must be set before publishing.';
