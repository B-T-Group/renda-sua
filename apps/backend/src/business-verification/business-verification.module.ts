import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessContractsModule } from '../business-contracts/business-contracts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { BusinessVerificationController } from './business-verification.controller';
import { BusinessVerificationService } from './business-verification.service';

@Module({
  imports: [
    AuthModule,
    HasuraModule,
    PdfModule,
    NotificationsModule,
    StripePaymentsModule,
    MerchantLifecycleModule,
    forwardRef(() => BusinessContractsModule),
  ],
  controllers: [BusinessVerificationController],
  providers: [BusinessVerificationService],
  exports: [BusinessVerificationService],
})
export class BusinessVerificationModule {}
