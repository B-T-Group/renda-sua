import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { AdminMobilePaymentsController } from './admin-mobile-payments.controller';
import { GiveChangePayoutService } from './give-change-payout.service';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsCoreModule } from './mobile-payments-core.module';
import { MobilePaymentsController } from './mobile-payments.controller';
import { PaymentCallbackRegistryService } from './payment-callback/payment-callback-registry.service';

@Module({
  imports: [MobilePaymentsCoreModule, AdminModule, AuthModule],
  controllers: [MobilePaymentsController, AdminMobilePaymentsController],
  providers: [
    MobilePaymentCallbackProcessor,
    PaymentCallbackRegistryService,
    GiveChangePayoutService,
  ],
  exports: [GiveChangePayoutService],
})
export class MobilePaymentsModule {}
