import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';
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
  ],
  controllers: [BusinessVerificationController],
  providers: [BusinessVerificationService],
  exports: [BusinessVerificationService],
})
export class BusinessVerificationModule {}
