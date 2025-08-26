-- Drop indexes first
DROP INDEX IF EXISTS idx_distance_cache_expires;
DROP INDEX IF EXISTS idx_distance_cache_origin;
DROP INDEX IF EXISTS idx_distance_cache_destination;
DROP INDEX IF EXISTS idx_distance_cache_origin_dest;
DROP INDEX IF EXISTS idx_geocode_cache_expires;
DROP INDEX IF EXISTS idx_geocode_cache_coords;

-- Drop tables
DROP TABLE IF EXISTS google_distance_cache;
DROP TABLE IF EXISTS google_geocode_cache;
