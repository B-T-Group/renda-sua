DELETE FROM public.country_delivery_configs
WHERE config_key = 'delivery_availability_radius_km';

DELETE FROM public.delivery_configs
WHERE config_key = 'delivery_availability_radius_km';
