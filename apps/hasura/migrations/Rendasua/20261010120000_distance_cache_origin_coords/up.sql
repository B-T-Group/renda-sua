ALTER TABLE google_distance_cache
  ADD COLUMN IF NOT EXISTS origin_latitude double precision,
  ADD COLUMN IF NOT EXISTS origin_longitude double precision;

CREATE INDEX IF NOT EXISTS idx_distance_cache_destination_origin_coords
  ON google_distance_cache (destination_address_id, origin_latitude, origin_longitude);
