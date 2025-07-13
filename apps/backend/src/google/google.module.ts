import { Module } from '@nestjs/common';
import { GoogleDistanceController } from './google-distance.controller';
import { GoogleDistanceService } from './google-distance.service';

@Module({
  providers: [GoogleDistanceService],
  controllers: [GoogleDistanceController],
  exports: [GoogleDistanceService],
})
export class GoogleModule {}
