import { forwardRef, Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { MtnMomoModule } from '../mtn-momo/mtn-momo.module';
import { OrangeMomoModule } from '../orange-momo/orange-momo.module';
import { RentalsModule } from '../rentals/rentals.module';
import { AdminMobilePaymentsController } from './admin-mobile-payments.controller';
import { GiveChangePayoutService } from './give-change-payout.service';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { FreemopayService } from './providers/freemopay.service';
import { MyPVitService } from './providers/mypvit.service';

@Module({
  imports: [
    forwardRef(() => RentalsModule),
    MtnMomoModule,
    OrangeMomoModule,
    AdminModule,
    AuthModule,
    HasuraModule,
  ],
  controllers: [MobilePaymentsController, AdminMobilePaymentsController],
  providers: [
    MobilePaymentsService,
    MobilePaymentsDatabaseService,
    MobilePaymentCallbackProcessor,
    GiveChangePayoutService,
    MyPVitService,
    FreemopayService,
  ],
  exports: [
    MobilePaymentsService,
    MobilePaymentsDatabaseService,
    GiveChangePayoutService,
  ],
})
export class MobilePaymentsModule {}
