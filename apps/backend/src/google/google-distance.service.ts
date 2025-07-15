import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { DistanceMatrixResponse } from './distance-matrix.types';

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
}
