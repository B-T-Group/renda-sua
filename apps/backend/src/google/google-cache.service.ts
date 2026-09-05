import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface CachedDistanceElement {
  destination_address_id: string;
  destination_address_formatted: string;
  origin_address_formatted: string;
  status: string;
  distance?: { text: string; value: number };
  duration?: { text: string; value: number };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

@Injectable()
export class GoogleCacheService {
  private readonly defaultTTL = 86400; // 1 day in seconds

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Check if cache tables exist
   */
  private async checkCacheTablesExist(): Promise<{
    distance: boolean;
    geocode: boolean;
  }> {
    const checkTablesQuery = `
      query CheckCacheTables {
        __schema {
          types {
            name
          }
        }
      }
    `;

    try {
      const schemaResult = await this.hasuraSystemService.executeQuery(
        checkTablesQuery
      );
      const tableNames =
        schemaResult.__schema?.types?.map((t: any) => t.name) || [];

      return {
        distance: tableNames.includes('google_distance_cache'),
        geocode: tableNames.includes('google_geocode_cache'),
      };
    } catch (error) {
      console.error('Error checking cache tables:', error);
      return { distance: false, geocode: false };
    }
  }

  /**
   * Valid (unexpired, not busted) cache hits. Partial results are OK — callers
   * should fetch only the missing destination IDs from Google.
   */
  async getValidCachedDistanceElements(
    originAddressId: string,
    destinationAddressIds: string[]
  ): Promise<CachedDistanceElement[]> {
    const destIds = destinationAddressIds.filter((id) => isUuid(id));
    if (!isUuid(originAddressId) || destIds.length === 0) return [];
    try {
      const rows = await this.queryDistanceCacheRows(originAddressId, destIds);
      return this.keepFreshCacheRows(originAddressId, destIds, rows);
    } catch (error) {
      console.error('Error fetching cached distance matrix:', error);
      return [];
    }
  }

  private async queryDistanceCacheRows(
    originAddressId: string,
    destinationAddressIds: string[]
  ): Promise<any[]> {
    const query = `
      query GetCachedDistanceMatrix($originId: uuid!, $destinationIds: [uuid!]!) {
        google_distance_cache(
          where: {
            origin_address_id: { _eq: $originId },
            destination_address_id: { _in: $destinationIds },
            expires_at: { _gt: "now()" }
          }
        ) {
          origin_address_id
          destination_address_id
          origin_address_formatted
          destination_address_formatted
          distance_value
          distance_text
          duration_value
          duration_text
          status
          created_at
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      originId: originAddressId,
      destinationIds: destinationAddressIds,
    });
    return result.google_distance_cache || [];
  }

  private async keepFreshCacheRows(
    originAddressId: string,
    destinationAddressIds: string[],
    cachedEntries: any[]
  ): Promise<CachedDistanceElement[]> {
    const addressIds = [
      originAddressId,
      ...destinationAddressIds.filter((id) => id !== originAddressId),
    ];
    const addressUpdatedAts = await this.getAddressUpdatedAts(addressIds);
    if (!addressUpdatedAts) return [];
    const originUpdatedAt = addressUpdatedAts.get(originAddressId);
    if (originUpdatedAt === undefined) return [];
    return cachedEntries
      .filter((entry) =>
        this.isCacheEntryFresh(entry, originUpdatedAt, addressUpdatedAts)
      )
      .map((entry) => this.toCachedElement(entry));
  }

  private isCacheEntryFresh(
    entry: any,
    originUpdatedAt: string,
    addressUpdatedAts: Map<string, string>
  ): boolean {
    const destUpdatedAt = addressUpdatedAts.get(entry.destination_address_id);
    if (destUpdatedAt === undefined) return false;
    const cacheCreated = new Date(entry.created_at).getTime();
    return (
      cacheCreated >= new Date(originUpdatedAt).getTime() &&
      cacheCreated >= new Date(destUpdatedAt).getTime()
    );
  }

  private toCachedElement(entry: any): CachedDistanceElement {
    const element: CachedDistanceElement = {
      destination_address_id: entry.destination_address_id,
      destination_address_formatted: entry.destination_address_formatted,
      origin_address_formatted: entry.origin_address_formatted,
      status: entry.status,
    };
    if (entry.distance_value && entry.distance_text) {
      element.distance = {
        text: entry.distance_text,
        value: entry.distance_value,
      };
    }
    if (entry.duration_value && entry.duration_text) {
      element.duration = {
        text: entry.duration_text,
        value: entry.duration_value,
      };
    }
    return element;
  }

  /**
   * Fetch updated_at for addresses by IDs (for cache busting).
   * Returns Map<id, updated_at> or null on error.
   */
  private async getAddressUpdatedAts(
    addressIds: string[]
  ): Promise<Map<string, string> | null> {
    if (addressIds.length === 0) return new Map();
    const query = `
      query GetAddressUpdatedAts($ids: [uuid!]!) {
        addresses(where: { id: { _in: $ids }, status: { _eq: active } }) {
          id
          updated_at
        }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        ids: addressIds,
      });
      const rows = result.addresses || [];
      const map = new Map<string, string>();
      for (const row of rows) {
        if (row.updated_at) map.set(row.id, row.updated_at);
      }
      return map;
    } catch (error) {
      console.error('Error fetching address updated_at:', error);
      return null;
    }
  }

  /**
   * Cache distance matrix results for individual origin-destination pairs
   */
  async cacheDistanceMatrixResults(
    originAddressId: string,
    originAddressFormatted: string,
    destinationAddresses: Array<{
      id: string;
      formatted: string;
    }>,
    googleResponse: any,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    // Extract results from Google API response
    const elements = googleResponse.rows[0]?.elements || [];

    // Prepare cache entries
    const cacheEntries = destinationAddresses.map((dest, index) => {
      const element = elements[index] || { status: 'NOT_FOUND' };

      return {
        origin_address_id: originAddressId,
        destination_address_id: dest.id,
        origin_address_formatted: originAddressFormatted,
        destination_address_formatted: dest.formatted,
        distance_value: element.distance?.value || null,
        distance_text: element.distance?.text || null,
        duration_value: element.duration?.value || null,
        duration_text: element.duration?.text || null,
        status: element.status || 'NOT_FOUND',
      };
    });

    // Batch insert/update cache entries
    const mutation = `
      mutation CacheDistanceMatrixResults($entries: [google_distance_cache_insert_input!]!) {
        insert_google_distance_cache(
          objects: $entries,
          on_conflict: {
            constraint: google_distance_cache_origin_address_id_destination_address_key,
            update_columns: [
              origin_address_formatted,
              destination_address_formatted,
              distance_value,
              distance_text,
              duration_value,
              duration_text,
              status,
              expires_at
            ]
          }
        ) {
          affected_rows
        }
      }
    `;

    try {
      await this.hasuraSystemService.executeMutation(mutation, {
        entries: cacheEntries.map((entry) => ({
          ...entry,
          expires_at: expiresAt,
        })),
      });
    } catch (error) {
      console.error('Error caching distance matrix results:', error);
    }
  }

  /**
   * Get cached geocoding result
   */
  async getCachedGeocode(lat: number, lng: number): Promise<any | null> {
    const query = `
      query GetCachedGeocode($lat: numeric!, $lng: numeric!) {
        google_geocode_cache(
          where: {
            latitude: { _eq: $lat },
            longitude: { _eq: $lng },
            expires_at: { _gt: "now()" }
          },
          limit: 1
        ) {
          id
          response_data
          created_at
          expires_at
        }
      }
    `;

    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        lat: lat.toString(),
        lng: lng.toString(),
      });

      if (
        result.google_geocode_cache &&
        result.google_geocode_cache.length > 0
      ) {
        return result.google_geocode_cache[0].response_data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching cached geocode:', error);
      return null;
    }
  }

  /**
   * Cache geocoding result
   */
  async cacheGeocode(
    lat: number,
    lng: number,
    responseData: any,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const mutation = `
      mutation CacheGeocode(
        $lat: numeric!,
        $lng: numeric!,
        $responseData: jsonb!,
        $expiresAt: timestamptz!
      ) {
        insert_google_geocode_cache(
          objects: [{
            latitude: $lat,
            longitude: $lng,
            response_data: $responseData,
            expires_at: $expiresAt
          }],
          on_conflict: {
            constraint: google_geocode_cache_latitude_longitude_key,
            update_columns: [response_data, expires_at]
          }
        ) {
          affected_rows
        }
      }
    `;

    try {
      await this.hasuraSystemService.executeMutation(mutation, {
        lat: lat.toString(),
        lng: lng.toString(),
        responseData,
        expiresAt,
      });
    } catch (error) {
      console.error('Error caching geocode:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<void> {
    const { distance, geocode } = await this.checkCacheTablesExist();

    try {
      // Only clean up tables that exist
      if (distance) {
        const distanceMutation = `
          mutation CleanupExpiredDistanceCache {
            delete_google_distance_cache(where: { expires_at: { _lt: "now()" } }) {
              affected_rows
            }
          }
        `;
        await this.hasuraSystemService.executeMutation(distanceMutation);
      }

      if (geocode) {
        const geocodeMutation = `
          mutation CleanupExpiredGeocodeCache {
            delete_google_geocode_cache(where: { expires_at: { _lt: "now()" } }) {
              affected_rows
            }
          }
        `;
        await this.hasuraSystemService.executeMutation(geocodeMutation);
      }
    } catch (error) {
      console.error('Error cleaning up expired cache:', error);
      // Don't throw error - this is a cleanup operation that shouldn't break the app
    }
  }
}
