-- Migration: trim_cm_delivery_time_slots_state
-- Description: For country_code = 'CM', trim " Region Province" suffix from delivery_time_slots.state
-- Example: "Littoral Region Province" -> "Littoral"
-- Step 0: Drop future_date check so updating slot_id on rows with past preferred_date does not fail.
ALTER TABLE public.delivery_time_windows DROP CONSTRAINT IF EXISTS future_date;

-- Step 1: Re-point delivery_time_windows from "Centre" slots to the equivalent "Centre Region Province"
--         slot (same slot_name, slot_type) so we can safely delete the duplicate Centre slots.
UPDATE public.delivery_time_windows w
SET slot_id = alt.id
FROM public.delivery_time_slots cur
JOIN public.delivery_time_slots alt
  ON alt.country_code = 'CM' AND alt.state = 'Centre Region Province'
  AND alt.slot_name = cur.slot_name AND alt.slot_type = cur.slot_type
WHERE w.slot_id = cur.id
  AND cur.country_code = 'CM' AND cur.state = 'Centre';

-- Step 2: Remove only the duplicate CM "Centre" standard slots (Morning/Afternoon/Evening).
--         Keep "Centre" fast slots (no Centre Region Province counterpart); they stay as state='Centre'.
DELETE FROM public.delivery_time_slots
WHERE country_code = 'CM'
  AND state = 'Centre'
  AND slot_type = 'standard'
  AND slot_name IN ('Morning', 'Afternoon', 'Evening');

-- Step 3: Trim " Region Province" from all CM state values.
UPDATE public.delivery_time_slots
SET state = REPLACE(state, ' Region Province', '')
WHERE country_code = 'CM'
  AND state IS NOT NULL
  AND state LIKE '% Region Province';

COMMENT ON TABLE public.delivery_time_slots IS 'Trimmed " Region Province" suffix from CM state names in delivery_time_slots';

-- Re-add future_date check. Use NOT VALID so existing rows with preferred_date in the past are not validated.
ALTER TABLE public.delivery_time_windows ADD CONSTRAINT future_date CHECK (preferred_date >= CURRENT_DATE) NOT VALID;
