-- Restore previous generated column semantics.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_storefront_visible BOOLEAN GENERATED ALWAYS AS (
    lifecycle_status NOT IN ('created', 'suspended')
  ) STORED;
