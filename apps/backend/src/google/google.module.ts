import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { HasuraModule } from '../hasura/hasura.module';
import { GoogleDistanceController } from './google-distance.controller';
import { GoogleDistanceService } from './google-distance.service';

@Module({
  imports: [AddressesModule, HasuraModule],
  providers: [GoogleDistanceService],
  controllers: [GoogleDistanceController],
  exports: [GoogleDistanceService],
})
export class GoogleModule {}
