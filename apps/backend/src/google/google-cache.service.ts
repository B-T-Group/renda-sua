import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface DistanceCacheEntry {
  origin_address_id: string;
  destination_address_id: string;
  origin_address_formatted: string;
  destination_address_formatted: string;
  distance_value: number;
  distance_text: string;
  duration_value: number;
  duration_text: string;
  status: string;
}

export interface CachedDistanceResult {
  origin_id: string;
  destination_ids: string[];
  destination_addresses: string[];
  origin_addresses: string[];
  rows: Array<{
    elements: Array<{
      status: string;
      distance?: { text: string; value: number };
      duration?: { text: string; value: number };
    }>;
  }>;
  status: string;
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
   * Get cached distance matrix results for specific origin-destination pairs
   */
  async getCachedDistanceMatrix(
    originAddressId: string,
    destinationAddressIds: string[]
  ): Promise<CachedDistanceResult | null> {
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
        }
      }
    `;

    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        originId: originAddressId,
        destinationIds: destinationAddressIds,
      });

      const cachedEntries = result.google_distance_cache || [];

      // Check if we have cached results for all requested destination addresses
      const cachedDestinationIds = new Set(
        cachedEntries.map((entry: any) => entry.destination_address_id)
      );
      const allCached = destinationAddressIds.every((id) =>
        cachedDestinationIds.has(id)
      );

      if (!allCached) {
        return null; // Not all destinations are cached
      }

      // Build the response in the same format as Google API
      const elements = destinationAddressIds.map((destId) => {
        const cachedEntry = cachedEntries.find(
          (entry: any) => entry.destination_address_id === destId
        );

        if (!cachedEntry) {
          return {
            status: 'NOT_FOUND',
          };
        }

        const element: any = {
          status: cachedEntry.status,
        };

        if (cachedEntry.distance_value && cachedEntry.distance_text) {
          element.distance = {
            text: cachedEntry.distance_text,
            value: cachedEntry.distance_value,
          };
        }

        if (cachedEntry.duration_value && cachedEntry.duration_text) {
          element.duration = {
            text: cachedEntry.duration_text,
            value: cachedEntry.duration_value,
          };
        }

        return element;
      });

      return {
        origin_id: originAddressId,
        destination_ids: destinationAddressIds,
        destination_addresses: destinationAddressIds.map((id) => {
          const cachedEntry = cachedEntries.find(
            (entry: any) => entry.destination_address_id === id
          );
          return cachedEntry?.destination_address_formatted || '';
        }),
        origin_addresses: [cachedEntries[0]?.origin_address_formatted || ''],
        rows: [{ elements }],
        status: 'OK',
      };
    } catch (error) {
      console.error('Error fetching cached distance matrix:', error);
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
