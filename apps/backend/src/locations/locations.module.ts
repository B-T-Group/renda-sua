import { Module } from '@nestjs/common';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { GoogleModule } from '../google/google.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [
    HasuraModule,
    GoogleModule,
    NotificationsModule,
    DeliveryConfigModule,
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
