-- Remove seeded data from supported_country_states table
DELETE FROM public.supported_country_states 
WHERE country_code IN ('GA', 'CM');


