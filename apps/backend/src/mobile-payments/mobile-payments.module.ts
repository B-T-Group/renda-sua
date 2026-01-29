import { Module } from '@nestjs/common';
import { MtnMomoModule } from '../mtn-momo/mtn-momo.module';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { MyPVitService } from './providers/mypvit.service';

@Module({
  imports: [MtnMomoModule],
  controllers: [MobilePaymentsController],
  providers: [
    MobilePaymentsService,
    MobilePaymentsDatabaseService,
    MyPVitService,
  ],
  exports: [MobilePaymentsService, MobilePaymentsDatabaseService],
})
export class MobilePaymentsModule {}
