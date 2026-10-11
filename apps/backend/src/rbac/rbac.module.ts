import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HasuraModule } from '../hasura/hasura.module';
import { PermissionsGuard } from './permissions.guard';
import { RbacCacheInterceptor } from './rbac-cache.interceptor';
import { RbacService } from './rbac.service';
import { GeoScopeService } from './geo-scope.service';
import { ScopedRolesService } from './scoped-roles.service';

@Module({
  imports: [HasuraModule],
  providers: [
    RbacService,
    GeoScopeService,
    ScopedRolesService,
    PermissionsGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: RbacCacheInterceptor,
    },
  ],
  exports: [RbacService, GeoScopeService, ScopedRolesService, PermissionsGuard],
})
export class RbacModule {}
