-- Rollback: remove restored CM Centre standard slots only (keep fast slots).

DELETE FROM public.delivery_time_slots
WHERE country_code = 'CM'
  AND state = 'Centre'
  AND slot_type = 'standard'
  AND slot_name IN ('Morning', 'Afternoon', 'Evening');
