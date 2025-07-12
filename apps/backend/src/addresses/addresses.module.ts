import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

@Module({
  imports: [HasuraModule],
  controllers: [AddressesController],
  providers: [AddressesService],
})
export class AddressesModule {}
