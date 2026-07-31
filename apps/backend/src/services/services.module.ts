import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AwsModule } from '../aws/aws.module';
import { HasuraModule } from '../hasura/hasura.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { UploadService } from './upload.service';

@Module({
  imports: [
    HasuraModule,
    AwsModule,
    AuthModule,
    NotificationsModule,
    forwardRef(() => MerchantLifecycleModule),
    forwardRef(() => StripePaymentsModule),
  ],
  providers: [UploadService],
  exports: [UploadService],
})
export class ServicesModule {}
