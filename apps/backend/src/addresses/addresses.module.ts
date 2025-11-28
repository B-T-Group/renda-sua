import { Global, Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { GoogleModule } from '../google/google.module';
import { PermissionService } from '../auth/permission.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [GoogleModule, AuthModule],
  controllers: [AddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
