-- No-op on purpose. set_public_agent_locations_updated_at is owned by
-- 1764196194000 (still applied after rolling this one back), and
-- 1764196194000/down.sql drops it. Dropping it here would leave agent_locations
-- without its updated_at trigger after `migrate apply --down 1`, so identical-
-- coordinate upserts would stop bumping updated_at (the #598 GPS cutoff relies
-- on that).
SELECT 1;
