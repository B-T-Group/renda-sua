-- Give every business location a default operating_hours value so that
-- delivery/pickup slot filtering always has hours to intersect against.
-- Default matches system-wide hours: Mon-Fri 08:00-20:00, Sat/Sun closed.

ALTER TABLE public.business_locations
  ALTER COLUMN operating_hours SET DEFAULT '{
    "monday": {"open": "08:00", "close": "20:00"},
    "tuesday": {"open": "08:00", "close": "20:00"},
    "wednesday": {"open": "08:00", "close": "20:00"},
    "thursday": {"open": "08:00", "close": "20:00"},
    "friday": {"open": "08:00", "close": "20:00"},
    "saturday": {"closed": true},
    "sunday": {"closed": true}
  }'::jsonb;

UPDATE public.business_locations
SET operating_hours = '{
  "monday": {"open": "08:00", "close": "20:00"},
  "tuesday": {"open": "08:00", "close": "20:00"},
  "wednesday": {"open": "08:00", "close": "20:00"},
  "thursday": {"open": "08:00", "close": "20:00"},
  "friday": {"open": "08:00", "close": "20:00"},
  "saturday": {"closed": true},
  "sunday": {"closed": true}
}'::jsonb
WHERE operating_hours IS NULL;

ALTER TABLE public.business_locations
  ALTER COLUMN operating_hours SET NOT NULL;

COMMENT ON COLUMN public.business_locations.operating_hours IS 'JSON object storing operating hours for each day (full day name keys, {"open","close"} or {"closed":true}). Defaults to system-wide Mon-Fri 08:00-20:00, Sat/Sun closed.';
