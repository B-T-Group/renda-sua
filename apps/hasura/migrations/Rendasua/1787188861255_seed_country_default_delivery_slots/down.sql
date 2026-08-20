-- Rollback country-level default delivery/pickup slots.

DELETE FROM public.delivery_time_slots
WHERE state = '__DEFAULT__'
  AND country_code IN ('CM', 'GA', 'CA');
