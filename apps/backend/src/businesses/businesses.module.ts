import { Module } from '@nestjs/common';
import { BusinessReferralPayoutsModule } from '../business-referral-payouts/business-referral-payouts.module';
import { BusinessReferralsModule } from '../business-referrals/business-referrals.module';
import { HasuraModule } from '../hasura/hasura.module';
import { BusinessesController } from './businesses.controller';

@Module({
  imports: [
    HasuraModule,
    BusinessReferralsModule,
    BusinessReferralPayoutsModule,
  ],
  controllers: [BusinessesController],
})
export class BusinessesModule {}
