import { Module } from '@nestjs/common';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { HasuraModule } from '../hasura/hasura.module';
import { LocationsController } from './locations.controller';

@Module({
  imports: [HasuraModule, DeliveryConfigModule],
  controllers: [LocationsController],
})
export class LocationsModule {}
