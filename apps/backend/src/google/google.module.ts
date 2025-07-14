import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { AddressesService } from '../addresses/addresses.service';
import { GoogleDistanceController } from './google-distance.controller';
import { GoogleDistanceService } from './google-distance.service';

@Module({
  imports: [AddressesModule],
  providers: [GoogleDistanceService, AddressesService],
  controllers: [GoogleDistanceController],
  exports: [GoogleDistanceService],
})
export class GoogleModule {}
