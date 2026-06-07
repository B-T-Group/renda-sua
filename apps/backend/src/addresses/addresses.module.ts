import { Global, Module } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

@Global()
@Module({
  controllers: [AddressesController],
  providers: [AddressesService, AuthGuard],
  exports: [AddressesService],
})
export class AddressesModule {}
