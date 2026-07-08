ALTER TABLE public.businesses DROP COLUMN IF EXISTS is_verified;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS can_accept_orders;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS is_storefront_visible;

ALTER TABLE public.businesses
  ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;

UPDATE public.businesses
SET is_verified = (lifecycle_status = 'active');

DROP TABLE IF EXISTS public.business_lifecycle_status_history;
DROP TABLE IF EXISTS public.business_payment_accounts;

ALTER TABLE public.businesses DROP COLUMN IF EXISTS lifecycle_status;

DROP TYPE IF EXISTS public.business_payment_provider_enum;
DROP TYPE IF EXISTS public.business_payment_capability_status_enum;
DROP TYPE IF EXISTS public.business_lifecycle_status_enum;
