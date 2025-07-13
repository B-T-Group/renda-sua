import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GoogleDistanceService {
  private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY;

  async getDistanceMatrix(origins: string[], destinations: string[]) {
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
      return response.data;
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
