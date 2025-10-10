import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { LocationsController } from './locations.controller';

@Module({
  imports: [HasuraModule],
  controllers: [LocationsController],
})
export class LocationsModule {}
