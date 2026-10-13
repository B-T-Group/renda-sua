import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { RepresentativeCommissionAdminController } from './representative-commission-admin.controller';
import { RepresentativeCommissionCronService } from './representative-commission-cron.service';
import { RepresentativeCommissionGridService } from './representative-commission-grid.service';
import { RepresentativeCommissionService } from './representative-commission.service';

@Module({
  imports: [HasuraModule, AccountsModule, StripePaymentsModule, AdminAuthModule],
  controllers: [RepresentativeCommissionAdminController],
  providers: [
    RepresentativeCommissionService,
    RepresentativeCommissionGridService,
    RepresentativeCommissionCronService,
    ConfigurationsService,
  ],
  exports: [RepresentativeCommissionService],
})
export class RepresentativeCommissionModule {}
