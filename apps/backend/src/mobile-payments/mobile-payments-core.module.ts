import { Global, Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { MtnMomoModule } from '../mtn-momo/mtn-momo.module';
import { OrangeMomoModule } from '../orange-momo/orange-momo.module';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsService } from './mobile-payments.service';
import { FreemopayService } from './providers/freemopay.service';
import { MyPVitService } from './providers/mypvit.service';

@Global()
@Module({
  imports: [HasuraModule, MtnMomoModule, OrangeMomoModule],
  providers: [
    MobilePaymentsService,
    MobilePaymentsDatabaseService,
    MyPVitService,
    FreemopayService,
  ],
  exports: [
    MobilePaymentsService,
    MobilePaymentsDatabaseService,
    MyPVitService,
    FreemopayService,
  ],
})
export class MobilePaymentsCoreModule {}
