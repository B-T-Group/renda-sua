-- Table for caching distance matrix results by individual address pairs
CREATE TABLE google_distance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_address_id UUID NOT NULL,
  destination_address_id UUID NOT NULL,
  origin_address_formatted TEXT NOT NULL,
  destination_address_formatted TEXT NOT NULL,
  distance_value INTEGER, -- in meters
  distance_text TEXT, -- human readable
  duration_value INTEGER, -- in seconds
  duration_text TEXT, -- human readable
  status TEXT NOT NULL, -- 'OK', 'NOT_FOUND', 'ZERO_RESULTS', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(origin_address_id, destination_address_id)
);

-- Table for caching geocoding results
CREATE TABLE google_geocode_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  response_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(latitude, longitude)
);

-- Indexes for performance
CREATE INDEX idx_distance_cache_expires ON google_distance_cache(expires_at);
CREATE INDEX idx_distance_cache_origin ON google_distance_cache(origin_address_id);
CREATE INDEX idx_distance_cache_destination ON google_distance_cache(destination_address_id);
CREATE INDEX idx_distance_cache_origin_dest ON google_distance_cache(origin_address_id, destination_address_id);
CREATE INDEX idx_geocode_cache_expires ON google_geocode_cache(expires_at);
CREATE INDEX idx_geocode_cache_coords ON google_geocode_cache(latitude, longitude);
