import { Module } from '@nestjs/common';
import { MobilePaymentsCoreModule } from './mobile-payments-core.module';
import { GiveChangePayoutService } from './give-change-payout.service';

/**
 * Slim module for commission payouts — avoids pulling AdminModule/AuthModule
 * into the AuthModule → AgentsModule → CommissionsModule import chain.
 */
@Module({
  imports: [MobilePaymentsCoreModule],
  providers: [GiveChangePayoutService],
  exports: [GiveChangePayoutService],
})
export class MobilePaymentsPayoutModule {}
