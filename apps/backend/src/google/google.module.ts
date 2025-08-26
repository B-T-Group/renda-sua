import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { HasuraModule } from '../hasura/hasura.module';
import { GoogleCacheCleanupService } from './google-cache-cleanup.service';
import { GoogleCacheService } from './google-cache.service';
import { GoogleDistanceController } from './google-distance.controller';
import { GoogleDistanceService } from './google-distance.service';

@Module({
  imports: [AddressesModule, HasuraModule],
  providers: [
    GoogleDistanceService,
    GoogleCacheService,
    GoogleCacheCleanupService,
  ],
  controllers: [GoogleDistanceController],
  exports: [GoogleDistanceService, GoogleCacheService],
})
export class GoogleModule {}
