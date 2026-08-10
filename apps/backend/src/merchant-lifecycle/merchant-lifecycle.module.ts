import { forwardRef, Module } from '@nestjs/common';
import { BusinessContractsModule } from '../business-contracts/business-contracts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { LaunchPromoModule } from '../launch-promo/launch-promo.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { MerchantLifecycleService } from './merchant-lifecycle.service';

@Module({
  imports: [
    HasuraModule,
    NotificationsModule,
    LaunchPromoModule,
    forwardRef(() => StripePaymentsModule),
    forwardRef(() => BusinessContractsModule),
  ],
  providers: [MerchantLifecycleService],
  exports: [MerchantLifecycleService],
})
export class MerchantLifecycleModule {}
