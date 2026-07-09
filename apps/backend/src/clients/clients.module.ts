import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { GoogleModule } from '../google/google.module';
import { LocationsModule } from '../locations/locations.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [HasuraModule, LocationsModule, GoogleModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
