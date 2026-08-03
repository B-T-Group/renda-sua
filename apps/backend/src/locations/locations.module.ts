import { Module } from '@nestjs/common';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CountryOnboardingService } from './country-onboarding.service';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [HasuraModule, NotificationsModule, DeliveryConfigModule],
  controllers: [LocationsController],
  providers: [LocationsService, CountryOnboardingService],
  exports: [LocationsService, CountryOnboardingService],
})
export class LocationsModule {}
