import { Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocationsService } from './locations.service';

@Module({
  imports: [HasuraModule, GoogleModule, NotificationsModule],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
