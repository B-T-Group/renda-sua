import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { DistanceMatrixResponse } from './distance-matrix.types';
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
   * @param options.ttlSeconds - Override cache TTL in seconds (e.g. 7776000 for 3 months)
   */
  async getDistanceMatrixWithCaching(
    originAddressId: string,
    originAddressFormatted: string,
    destinationAddresses: Array<{
      id: string;
      formatted: string;
    }>,
    options?: { ttlSeconds?: number }
  ): Promise<DistanceMatrixResponse> {
    const ttl = options?.ttlSeconds ?? this.cacheTTL;
    try {
      const destinationIds = destinationAddresses.map((dest) => dest.id);

      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cachedResult = await this.cacheService.getCachedDistanceMatrix(
          originAddressId,
          destinationIds
        );

        if (cachedResult) {
          return cachedResult;
        }
      }
      this.logger.log('Not all destination pairs cached, calling Google API', destinationIds);
      // Not all destinations are cached, call Google API

      const destinationStrs = destinationAddresses.map((dest) => dest.formatted);
      const googleResponse = await this.callGoogleDistanceMatrix(
        [originAddressFormatted],
        destinationStrs
      );

      this.logger.log('Google API response:', googleResponse);

      // Cache the results if enabled
      if (this.cacheEnabled) {
        await this.cacheService.cacheDistanceMatrixResults(
          originAddressId,
          originAddressFormatted,
          destinationAddresses,
          googleResponse,
          ttl
        );
      }

      return googleResponse;
    } catch (error) {
      this.logger.error(
        `getDistanceMatrixWithCaching failed: origin=${originAddressId}, destinations=${destinationAddresses.map((d) => d.id).join(',')}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined
      );
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
    return this.callGoogleDistanceMatrix(origins, destinations);
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
      if (response.data.status !== 'OK') {
        throw new HttpException(
          response.data.error_message || 'Google API error',
          HttpStatus.BAD_REQUEST
        );
      }
      return response.data as DistanceMatrixResponse;
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
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
      const postalCode = this.getAddressComponent(addressComponents, [
        'postal_code',
      ]);

      const geocodingResult = {
        formatted_address: result.formatted_address,
        city: city || '',
        state: state || '',
        country: country || '',
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
