-- Remove accounts that are tied to business_location_id (location-scoped accounts only)
DELETE FROM public.accounts WHERE business_location_id IS NOT NULL;
