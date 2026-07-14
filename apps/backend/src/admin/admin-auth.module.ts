import { Module } from '@nestjs/common';
import { PermissionService } from '../auth/permission.service';
import { HasuraModule } from '../hasura/hasura.module';
import { RbacModule } from '../rbac/rbac.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { BusinessAdminGuard } from './business-admin.guard';

/**
 * Slim module for admin route guards — avoids pulling full AuthModule /
 * AdminModule into StripeTaxModule / StripePaymentsModule circular import chains.
 */
@Module({
  imports: [HasuraModule, RbacModule],
  providers: [PermissionService, AdminAuthGuard, BusinessAdminGuard],
  exports: [AdminAuthGuard, BusinessAdminGuard, PermissionService, RbacModule],
})
export class AdminAuthModule {}
