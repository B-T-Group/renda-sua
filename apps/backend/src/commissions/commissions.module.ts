import { forwardRef, Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { MobilePaymentsModule } from '../mobile-payments/mobile-payments.module';
import { CommissionsService } from './commissions.service';

@Module({
  imports: [
    AccountsModule,
    HasuraModule,
    forwardRef(() => MobilePaymentsModule),
  ],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
