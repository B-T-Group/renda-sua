-- Remove business locations for the specified business
DELETE FROM public.business_locations 
WHERE business_id = 'eb6b7525-ab79-416e-bac8-254b1e8a6d6c';

-- Remove addresses for the specified business
DELETE FROM public.addresses 
WHERE entity_type = 'business' 
AND entity_id = 'eb6b7525-ab79-416e-bac8-254b1e8a6d6c';
