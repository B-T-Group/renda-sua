import { forwardRef, Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { MtnMomoModule } from '../mtn-momo/mtn-momo.module';
import { OrangeMomoModule } from '../orange-momo/orange-momo.module';
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
    HasuraModule,
    MtnMomoModule,
    OrangeMomoModule,
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../admin/admin.module').AdminModule;
    }),
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../auth/auth.module').AuthModule;
    }),
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../rentals/rentals.module').RentalsModule;
    }),
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
