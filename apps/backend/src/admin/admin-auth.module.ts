import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { RbacModule } from '../rbac/rbac.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { BusinessAdminGuard } from './business-admin.guard';

/**
 * Slim module for admin route guards — avoids pulling full AdminModule
 * into StripeTaxModule / StripePaymentsModule circular import chains.
 */
@Module({
  imports: [HasuraModule, AuthModule, RbacModule],
  providers: [AdminAuthGuard, BusinessAdminGuard],
  exports: [AdminAuthGuard, BusinessAdminGuard, AuthModule, RbacModule],
})
export class AdminAuthModule {}
