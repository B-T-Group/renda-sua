-- Remove seeded delivery time slots for Gabon
DELETE FROM public.delivery_time_slots WHERE country_code = 'GA';
