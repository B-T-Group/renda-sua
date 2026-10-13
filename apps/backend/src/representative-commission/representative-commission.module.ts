import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { HasuraModule } from '../hasura/hasura.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { RepresentativeCommissionCronService } from './representative-commission-cron.service';
import { RepresentativeCommissionGridService } from './representative-commission-grid.service';
import { RepresentativeCommissionService } from './representative-commission.service';

@Module({
  imports: [HasuraModule, AccountsModule, StripePaymentsModule],
  providers: [
    RepresentativeCommissionService,
    RepresentativeCommissionGridService,
    RepresentativeCommissionCronService,
    ConfigurationsService,
  ],
  exports: [RepresentativeCommissionService],
})
export class RepresentativeCommissionModule {}
