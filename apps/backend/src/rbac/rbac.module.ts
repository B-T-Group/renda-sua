import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { PermissionsGuard } from './permissions.guard';
import { RbacService } from './rbac.service';

@Module({
  imports: [HasuraModule],
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
