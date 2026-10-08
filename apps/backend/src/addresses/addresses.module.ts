import { Global, Module } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AddressGeocodeCronService } from './address-geocode-cron.service';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { CurrentLocationAddressService } from './current-location-address.service';

@Global()
@Module({
  controllers: [AddressesController],
  providers: [
    AddressesService,
    AddressGeocodeCronService,
    CurrentLocationAddressService,
    AuthGuard,
  ],
  exports: [AddressesService, CurrentLocationAddressService],
})
export class AddressesModule {}
