import { Controller, Get, Query } from '@nestjs/common';
import { GoogleDistanceService } from './google-distance.service';

@Controller('distance-matrix')
export class GoogleDistanceController {
  constructor(private readonly googleDistanceService: GoogleDistanceService) {}

  @Get()
  async getDistance(
    @Query('origins') origins: string,
    @Query('destinations') destinations: string
  ) {
    // origins and destinations are comma-separated strings
    const originArr = origins.split(',');
    const destinationArr = destinations.split(',');
    return this.googleDistanceService.getDistanceMatrix(
      originArr,
      destinationArr
    );
  }
}
