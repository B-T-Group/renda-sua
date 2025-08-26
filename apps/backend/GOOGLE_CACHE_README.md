# Google API Caching Implementation

This implementation provides caching for Google Distance Matrix and Geocoding API results to improve performance and reduce API costs.

## Features

- **Individual Pair Caching**: Each origin-destination address pair is cached separately
- **Complete Cache Check**: Only returns cached results if ALL requested destination pairs are cached and valid
- **Partial Cache Handling**: If some pairs are missing from cache, calls Google API for all pairs and updates cache
- **Address ID Based**: Uses actual address IDs from the database for cache keys
- **Automatic Cleanup**: Expired cache entries are automatically cleaned up daily
- **Configurable TTL**: Cache duration can be configured via environment variables

## Database Tables

### google_distance_cache

Stores cached distance matrix results for individual origin-destination address pairs.

```sql
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
```

### google_geocode_cache

Stores cached geocoding results for coordinate pairs.

```sql
CREATE TABLE google_geocode_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  response_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(latitude, longitude)
);
```

## Configuration

### Environment Variables

- `GOOGLE_CACHE_ENABLED`: Enable/disable caching (default: true)
- `GOOGLE_CACHE_TTL`: Cache time-to-live in seconds (default: 86400 = 1 day)

### Example .env

```env
GOOGLE_CACHE_ENABLED=true
GOOGLE_CACHE_TTL=86400
```

## Usage

### Distance Matrix API

The caching is automatically applied when calling the distance matrix endpoint:

```typescript
// POST /google/distance-matrix
{
  "destination_address_ids": ["uuid1", "uuid2"],
  "origin_address_id": "origin-uuid"
}
```

The system will:

1. Check if all origin-destination pairs are cached and valid
2. If all cached, return cached results
3. If not all cached, call Google API and cache all results
4. Return the complete response

### Geocoding API

The caching is automatically applied when calling the geocoding endpoint:

```typescript
// GET /google/geocode?lat=1.234&lng=5.678
```

The system will:

1. Check if coordinates are cached and valid
2. If cached, return cached result
3. If not cached, call Google API and cache the result
4. Return the geocoding result

## Implementation Details

### Services

- `GoogleCacheService`: Handles all cache operations
- `GoogleDistanceService`: Updated to use caching
- `GoogleCacheCleanupService`: Scheduled cleanup of expired entries

### Cache Logic

1. **Distance Matrix**:

   - Caches individual origin-destination pairs
   - Only returns cached results if ALL requested pairs are cached
   - If any pair is missing, calls Google API for all pairs and caches results

2. **Geocoding**:
   - Caches individual coordinate pairs
   - Simple cache hit/miss logic

### Cleanup

- Automatic cleanup runs daily at midnight
- Removes all expired cache entries
- Uses cron job via `@nestjs/schedule`

## Benefits

- **Performance**: Reduces API response times for cached results
- **Cost Savings**: Reduces Google API usage and associated costs
- **Reliability**: Provides fallback data when Google API is temporarily unavailable
- **Scalability**: Database storage persists across service restarts
- **Flexibility**: Configurable TTL and enable/disable options

## Migration

The database migration has been applied:

- Migration ID: `1756183131_create_google_cache_tables`
- Tables are tracked in Hasura
- Indexes are created for optimal performance

## Testing

To test the implementation:

1. Make a distance matrix request with address IDs
2. Check the database for cached entries
3. Make the same request again - should return cached results
4. Wait for TTL to expire and verify cleanup works
