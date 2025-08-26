import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
}

@Injectable()
export class GoogleDistanceService {
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
   * Get distance matrix with caching based on address IDs
   */
  async getDistanceMatrixWithCaching(
    originAddressId: string,
    originAddressFormatted: string,
    destinationAddresses: Array<{
      id: string;
      formatted: string;
    }>
  ): Promise<DistanceMatrixResponse> {
    const destinationIds = destinationAddresses.map((dest) => dest.id);

    // Check cache first if enabled
    if (this.cacheEnabled) {
      const cachedResult = await this.cacheService.getCachedDistanceMatrix(
        originAddressId,
        destinationIds
      );

      if (cachedResult) {
        console.log(
          'Using cached distance matrix result for all destination pairs'
        );
        return cachedResult;
      }
    }

    // Not all destinations are cached, call Google API
    console.log('Not all destination pairs cached, calling Google API');

    const destinationStrs = destinationAddresses.map((dest) => dest.formatted);
    const googleResponse = await this.callGoogleDistanceMatrix(
      [originAddressFormatted],
      destinationStrs
    );

    // Cache the results if enabled
    if (this.cacheEnabled) {
      await this.cacheService.cacheDistanceMatrixResults(
        originAddressId,
        originAddressFormatted,
        destinationAddresses,
        googleResponse,
        this.cacheTTL
      );
    }

    return googleResponse;
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

  private getAddressComponent(
    components: any[],
    types: string[]
  ): string | null {
    for (const component of components) {
      if (component.types.some((type: string) => types.includes(type))) {
        return component.long_name;
      }
    }
    return null;
  }
}
