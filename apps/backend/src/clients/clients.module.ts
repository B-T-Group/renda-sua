import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [HasuraModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
