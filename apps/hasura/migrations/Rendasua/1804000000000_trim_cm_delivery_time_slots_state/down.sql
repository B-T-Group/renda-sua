-- Reverse migration: restore \" Region Province\" suffix for CM delivery_time_slots.state

UPDATE public.delivery_time_slots
SET state = state || ' Region Province'
WHERE country_code = 'CM'
  AND state IS NOT NULL
  AND state NOT LIKE '% Region Province'
  AND state IN (
    'Littoral',
    'Centre',
    'Ouest',
    'Nord-Ouest',
    'Sud-Ouest'
  );

COMMENT ON TABLE public.delivery_time_slots IS 'Restored \" Region Province\" suffix on CM state names in delivery_time_slots';

