DROP INDEX IF EXISTS idx_distance_cache_destination_origin_coords;

ALTER TABLE google_distance_cache
  DROP COLUMN IF EXISTS origin_longitude,
  DROP COLUMN IF EXISTS origin_latitude;
