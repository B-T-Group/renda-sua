import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HasuraModule } from '../hasura/hasura.module';
import { PermissionsGuard } from './permissions.guard';
import { RbacCacheInterceptor } from './rbac-cache.interceptor';
import { RbacService } from './rbac.service';

@Module({
  imports: [HasuraModule],
  providers: [
    RbacService,
    PermissionsGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: RbacCacheInterceptor,
    },
  ],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
