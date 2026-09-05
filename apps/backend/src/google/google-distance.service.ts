import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  DistanceMatrixElement,
  DistanceMatrixResponse,
} from './distance-matrix.types';
import type { CachedDistanceElement } from './google-cache.service';
import { GoogleCacheService } from './google-cache.service';

export interface GeocodingResult {
  formatted_address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  address_line_1?: string;
  country_code?: string;
}

export interface PlacePrediction {
  place_id: string;
  description: string;
}

/** Google Distance Matrix legacy API: max 25 origins or destinations per request. */
export const DISTANCE_MATRIX_MAX_DESTINATIONS = 25;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DestinationAddress = { id: string; formatted: string };

type ElementMaps = {
  elements: Map<string, DistanceMatrixElement>;
  addresses: Map<string, string>;
};

@Injectable()
export class GoogleDistanceService {
  private readonly logger = new Logger(GoogleDistanceService.name);
  private readonly apiKey;
  private readonly cacheEnabled: boolean;
  private readonly cacheTTL: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: GoogleCacheService
  ) {
    this.apiKey = this.configService.get('GOOGLE_MAPS_API_KEY');
    this.cacheEnabled = this.configService.get('GOOGLE_CACHE_ENABLED', true);
    this.cacheTTL = this.configService.get('GOOGLE_CACHE_TTL', 86400); // 1 day
  }

  /**
   * Get distance matrix with caching based on address IDs.
   * Fetches only cache misses, in chunks of 25 destinations.
   */
  async getDistanceMatrixWithCaching(
    originAddressId: string,
    originAddressFormatted: string,
    destinationAddresses: DestinationAddress[],
    options?: { ttlSeconds?: number }
  ): Promise<DistanceMatrixResponse> {
    const ttl = options?.ttlSeconds ?? this.cacheTTL;
    try {
      const maps = await this.resolveDistanceElements(
        originAddressId,
        originAddressFormatted,
        destinationAddresses,
        ttl
      );
      return this.buildDistanceMatrix(
        originAddressFormatted,
        destinationAddresses,
        maps
      );
    } catch (error) {
      this.logDistanceMatrixFailure(originAddressId, destinationAddresses, error);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async getDistanceMatrix(
    origins: string[],
    destinations: string[]
  ): Promise<DistanceMatrixResponse> {
    if (origins.length === 1 && destinations.length > DISTANCE_MATRIX_MAX_DESTINATIONS) {
      return this.callGoogleDistanceMatrixChunked(origins[0], destinations);
    }
    return this.callGoogleDistanceMatrix(origins, destinations);
  }

  private async resolveDistanceElements(
    originId: string,
    originFormatted: string,
    destinations: DestinationAddress[],
    ttl: number
  ): Promise<ElementMaps> {
    if (destinations.length === 0) {
      return { elements: new Map(), addresses: new Map() };
    }
    const cached = await this.loadCachedElements(originId, destinations);
    const missing = destinations.filter((d) => !cached.elements.has(d.id));
    if (missing.length === 0) return cached;
    this.logger.log(
      `Distance matrix cache: ${cached.elements.size} hit, ${missing.length} miss`
    );
    const fetched = await this.fetchMissingInChunks(
      originId,
      originFormatted,
      missing,
      ttl
    );
    return this.mergeElementMaps(cached, fetched);
  }

  private async loadCachedElements(
    originId: string,
    destinations: DestinationAddress[]
  ): Promise<ElementMaps> {
    const empty: ElementMaps = { elements: new Map(), addresses: new Map() };
    if (!this.cacheEnabled || !UUID_PATTERN.test(originId)) return empty;
    const entries = await this.cacheService.getValidCachedDistanceElements(
      originId,
      destinations.map((d) => d.id)
    );
    return this.mapsFromCachedEntries(entries);
  }

  private async fetchMissingInChunks(
    originId: string,
    originFormatted: string,
    missing: DestinationAddress[],
    ttl: number
  ): Promise<ElementMaps> {
    const maps: ElementMaps = { elements: new Map(), addresses: new Map() };
    for (const chunk of this.chunkDestinations(missing)) {
      const response = await this.callGoogleDistanceMatrix(
        [originFormatted],
        chunk.map((d) => d.formatted)
      );
      this.applyChunkResponse(chunk, response, maps);
      await this.cacheChunkIfEnabled(
        originId,
        originFormatted,
        chunk,
        response,
        ttl
      );
    }
    return maps;
  }

  private async cacheChunkIfEnabled(
    originId: string,
    originFormatted: string,
    chunk: DestinationAddress[],
    response: DistanceMatrixResponse,
    ttl: number
  ): Promise<void> {
    if (!this.cacheEnabled || !UUID_PATTERN.test(originId)) return;
    await this.cacheService.cacheDistanceMatrixResults(
      originId,
      originFormatted,
      chunk,
      response,
      ttl
    );
  }

  private async callGoogleDistanceMatrixChunked(
    origin: string,
    destinations: string[]
  ): Promise<DistanceMatrixResponse> {
    const destObjs = destinations.map((formatted, i) => ({
      id: String(i),
      formatted,
    }));
    const maps: ElementMaps = { elements: new Map(), addresses: new Map() };
    for (const chunk of this.chunkDestinations(destObjs)) {
      const response = await this.callGoogleDistanceMatrix(
        [origin],
        chunk.map((d) => d.formatted)
      );
      this.applyChunkResponse(chunk, response, maps);
    }
    return this.buildDistanceMatrix(origin, destObjs, maps);
  }

  private chunkDestinations(destinations: DestinationAddress[]): DestinationAddress[][] {
    const chunks: DestinationAddress[][] = [];
    for (let i = 0; i < destinations.length; i += DISTANCE_MATRIX_MAX_DESTINATIONS) {
      chunks.push(
        destinations.slice(i, i + DISTANCE_MATRIX_MAX_DESTINATIONS)
      );
    }
    return chunks;
  }

  private applyChunkResponse(
    chunk: DestinationAddress[],
    response: DistanceMatrixResponse,
    maps: ElementMaps
  ): void {
    const row = response.rows?.[0]?.elements ?? [];
    chunk.forEach((dest, i) => {
      maps.elements.set(dest.id, row[i] ?? { status: 'NOT_FOUND' });
      maps.addresses.set(
        dest.id,
        response.destination_addresses?.[i] ?? dest.formatted
      );
    });
  }

  private mapsFromCachedEntries(entries: CachedDistanceElement[]): ElementMaps {
    const maps: ElementMaps = { elements: new Map(), addresses: new Map() };
    for (const entry of entries) {
      maps.elements.set(entry.destination_address_id, {
        status: entry.status,
        ...(entry.distance ? { distance: entry.distance } : {}),
        ...(entry.duration ? { duration: entry.duration } : {}),
      });
      maps.addresses.set(
        entry.destination_address_id,
        entry.destination_address_formatted
      );
    }
    return maps;
  }

  private mergeElementMaps(cached: ElementMaps, fetched: ElementMaps): ElementMaps {
    const elements = new Map(cached.elements);
    const addresses = new Map(cached.addresses);
    for (const [id, el] of fetched.elements) elements.set(id, el);
    for (const [id, addr] of fetched.addresses) addresses.set(id, addr);
    return { elements, addresses };
  }

  private buildDistanceMatrix(
    originFormatted: string,
    destinations: DestinationAddress[],
    maps: ElementMaps
  ): DistanceMatrixResponse {
    return {
      origin_addresses: [originFormatted],
      destination_addresses: destinations.map(
        (d) => maps.addresses.get(d.id) ?? d.formatted
      ),
      rows: [
        {
          elements: destinations.map(
            (d) => maps.elements.get(d.id) ?? { status: 'NOT_FOUND' }
          ),
        },
      ],
      status: 'OK',
    };
  }

  private logDistanceMatrixFailure(
    originAddressId: string,
    destinationAddresses: DestinationAddress[],
    error: unknown
  ): void {
    const destIds = destinationAddresses.map((d) => d.id).join(',');
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `getDistanceMatrixWithCaching failed: origin=${originAddressId}, destinations=${destIds}: ${message}`,
      error instanceof Error ? error.stack : undefined
    );
  }

  /**
   * Call Google Distance Matrix API directly
   */
  private async callGoogleDistanceMatrix(
    origins: string[],
    destinations: string[]
  ): Promise<DistanceMatrixResponse> {
    const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    const params = {
      origins: origins.join('|'),
      destinations: destinations.join('|'),
      key: this.apiKey,
    };
    try {
      const response = await axios.get(url, { params });
      this.assertGoogleMatrixOk(response.data);
      return response.data as DistanceMatrixResponse;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private assertGoogleMatrixOk(data: {
    status?: string;
    error_message?: string;
  }): void {
    if (data?.status === 'OK') return;
    const status = data?.status || 'UNKNOWN';
    const detail = data?.error_message || 'Google API error';
    this.logger.error(`Distance Matrix failed: status=${status}, detail=${detail}`);
    throw new HttpException(
      `Google Distance Matrix ${status}: ${detail}`,
      HttpStatus.BAD_REQUEST
    );
  }

  /**
   * Reverse geocode with caching
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodingResult> {
    // Check cache first if enabled
    if (this.cacheEnabled) {
      const cachedResult = await this.cacheService.getCachedGeocode(lat, lng);

      if (cachedResult) {
        console.log('Using cached geocoding result');
        return cachedResult;
      }
    }

    // Call Google API
    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
      latlng: `${lat},${lng}`,
      key: this.apiKey,
    };

    try {
      const response = await axios.get(url, { params });

      if (response.data.status !== 'OK') {
        throw new HttpException(
          response.data.error_message || 'Google Geocoding API error',
          HttpStatus.BAD_REQUEST
        );
      }

      const results = response.data.results;
      if (!results || results.length === 0) {
        throw new HttpException(
          'No geocoding results found',
          HttpStatus.NOT_FOUND
        );
      }

      const result = results[0];
      const addressComponents = result.address_components;

      // Extract address components
      const city = this.getAddressComponent(addressComponents, [
        'locality',
        'sublocality',
      ]);
      const state = this.getAddressComponent(addressComponents, [
        'administrative_area_level_1',
      ]);
      const country = this.getAddressComponent(addressComponents, ['country']);
      // ISO-2 code (e.g. "CA") — profile/business addresses store codes, not names.
      const countryCode = this.getAddressComponent(
        addressComponents,
        ['country'],
        true
      );
      const postalCode = this.getAddressComponent(addressComponents, [
        'postal_code',
      ]);

      const geocodingResult = {
        formatted_address: result.formatted_address,
        city: city || '',
        state: state || '',
        country: country || '',
        country_code: countryCode || '',
        postal_code: postalCode || '',
      };

      // Cache the result if enabled
      if (this.cacheEnabled) {
        await this.cacheService.cacheGeocode(
          lat,
          lng,
          geocodingResult,
          this.cacheTTL
        );
      }

      return geocodingResult;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Forward geocode (address -> lat/lng)
   */
  async geocode(
    address: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (!address || address.trim() === '') {
      return null;
    }

    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = {
      address: address,
      key: this.apiKey,
    };

    try {
      const response = await axios.get(url, { params });

      if (
        response.data.status === 'OK' &&
        response.data.results &&
        response.data.results.length > 0
      ) {
        const location = response.data.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng,
        };
      }

      // Handle various error statuses
      if (response.data.status === 'ZERO_RESULTS') {
        return null;
      }

      // Log other statuses but return null
      this.logger.warn(
        `Geocoding failed for address "${address}": ${response.data.status}`
      );
      return null;
    } catch (error: any) {
      this.logger.error(
        `Error geocoding address "${address}": ${error.message}`
      );
      return null;
    }
  }

  /**
   * Google Places Autocomplete (text predictions), optionally restricted to a
   * 2-letter country code.
   */
  async placesAutocomplete(
    input: string,
    country?: string
  ): Promise<PlacePrediction[]> {
    const trimmed = (input || '').trim();
    if (trimmed.length < 3) {
      return [];
    }
    const url =
      'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params: Record<string, string> = { input: trimmed, key: this.apiKey };
    if (country && country.trim().length === 2) {
      params.components = `country:${country.trim().toLowerCase()}`;
    }
    try {
      const response = await axios.get(url, { params });
      const status = response.data.status;
      if (status !== 'OK' && status !== 'ZERO_RESULTS') {
        this.logger.warn(`Places autocomplete failed: ${status}`);
        return [];
      }
      return (response.data.predictions || []).map((p: any) => ({
        place_id: p.place_id,
        description: p.description,
      }));
    } catch (error: any) {
      this.logger.error(`Places autocomplete error: ${error.message}`);
      return [];
    }
  }

  /**
   * Resolve a Google place_id into a structured address.
   */
  async placeDetails(placeId: string): Promise<GeocodingResult> {
    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const params = {
      place_id: placeId,
      fields: 'address_component,formatted_address',
      key: this.apiKey,
    };
    const response = await axios.get(url, { params });
    if (response.data.status !== 'OK' || !response.data.result) {
      throw new HttpException(
        response.data.error_message || 'Google Place Details API error',
        HttpStatus.BAD_REQUEST
      );
    }
    return this.parsePlaceDetails(response.data.result);
  }

  private parsePlaceDetails(result: any): GeocodingResult {
    const components = result.address_components || [];
    const streetNumber = this.getAddressComponent(components, [
      'street_number',
    ]);
    const route = this.getAddressComponent(components, ['route']);
    const addressLine1 = [streetNumber, route].filter(Boolean).join(' ');
    return {
      formatted_address: result.formatted_address || '',
      city:
        this.getAddressComponent(components, ['locality', 'sublocality']) || '',
      state:
        this.getAddressComponent(components, [
          'administrative_area_level_1',
        ]) || '',
      country: this.getAddressComponent(components, ['country']) || '',
      country_code:
        this.getAddressComponent(components, ['country'], true) || '',
      postal_code: this.getAddressComponent(components, ['postal_code']) || '',
      address_line_1: addressLine1,
    };
  }

  private getAddressComponent(
    components: any[],
    types: string[],
    shortName = false
  ): string | null {
    for (const component of components) {
      if (component.types.some((type: string) => types.includes(type))) {
        return shortName ? component.short_name : component.long_name;
      }
    }
    return null;
  }
}
