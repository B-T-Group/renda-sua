import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from '../accounts/accounts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { MyPVitService } from './providers/mypvit.service';

@Module({
  imports: [ConfigModule, HasuraModule, AccountsModule],
  controllers: [MobilePaymentsController],
  providers: [
    MobilePaymentsService,
    MobilePaymentsDatabaseService,
    MyPVitService,
  ],
  exports: [MobilePaymentsService, MobilePaymentsDatabaseService],
})
export class MobilePaymentsModule {}
