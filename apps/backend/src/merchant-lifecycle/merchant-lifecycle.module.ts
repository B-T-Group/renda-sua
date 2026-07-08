import { forwardRef, Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { MerchantLifecycleService } from './merchant-lifecycle.service';

@Module({
  imports: [
    HasuraModule,
    NotificationsModule,
    forwardRef(() => StripePaymentsModule),
  ],
  providers: [MerchantLifecycleService],
  exports: [MerchantLifecycleService],
})
export class MerchantLifecycleModule {}
