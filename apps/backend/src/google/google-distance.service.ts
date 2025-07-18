import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { DistanceMatrixResponse } from './distance-matrix.types';

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

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get('GOOGLE_MAPS_API_KEY');
  }
  /**
   * origins and destinations are arrays of formatted address strings (lat,lng or full address)
   */
  async getDistanceMatrix(
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
   * Reverse geocode coordinates to get address information
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodingResult> {
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

      return {
        formatted_address: result.formatted_address,
        city: city || '',
        state: state || '',
        country: country || '',
        postal_code: postalCode || '',
      };
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
