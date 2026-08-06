-- Catalog visibility now keys off can_accept_orders (lifecycle_status = active).
-- Drop the generated is_storefront_visible column (was: not created/suspended).
ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS is_storefront_visible;
