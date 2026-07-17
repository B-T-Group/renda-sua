import { Module } from '@nestjs/common';
import { DeliveryAvailabilityModule } from '../delivery-availability/delivery-availability.module';
import { HasuraModule } from '../hasura/hasura.module';
import { LocationsModule } from '../locations/locations.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [HasuraModule, LocationsModule, DeliveryAvailabilityModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
