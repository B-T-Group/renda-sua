import { Module, forwardRef } from '@nestjs/common';
import { ConfigurationsService } from '../admin/configurations.service';
import { CommissionsModule } from '../commissions/commissions.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { RepresentativeCompensationService } from './representative-compensation.service';

@Module({
  imports: [StripePaymentsModule, ReferralsModule, forwardRef(() => CommissionsModule)],
  providers: [RepresentativeCompensationService, ConfigurationsService],
  exports: [RepresentativeCompensationService],
})
export class RepresentativeCompensationModule {}
