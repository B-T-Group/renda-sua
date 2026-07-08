import { Module } from '@nestjs/common';
import { PermissionService } from '../auth/permission.service';
import { HasuraModule } from '../hasura/hasura.module';
import { AdminAuthGuard } from './admin-auth.guard';

/**
 * Slim module for admin route guards — avoids pulling full AdminModule
 * into StripeTaxModule / StripePaymentsModule circular import chains.
 */
@Module({
  imports: [HasuraModule],
  providers: [PermissionService, AdminAuthGuard],
  exports: [AdminAuthGuard, PermissionService],
})
export class AdminAuthModule {}
