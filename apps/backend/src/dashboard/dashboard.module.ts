import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiImageCleanupModule } from '../ai-image-cleanup/ai-image-cleanup.module';
import { BusinessItemsModule } from '../business-items/business-items.module';
import { HasuraModule } from '../hasura/hasura.module';
import { RbacModule } from '../rbac/rbac.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    HasuraModule,
    AuthModule,
    RbacModule,
    BusinessItemsModule,
    AiImageCleanupModule,
    StripePaymentsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
