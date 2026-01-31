-- Rollback: add_delivery_slots_cm_centre
-- Remove delivery_time_slots for country CM (Cameroon) and state Centre.

DELETE FROM public.delivery_time_slots
WHERE country_code = 'CM' AND state = 'Centre';
