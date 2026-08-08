import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MerchantEngagementController } from './merchant-engagement.controller';
import { MerchantEngagementCronService } from './merchant-engagement-cron.service';
import { MerchantEngagementService } from './merchant-engagement.service';

@Module({
  imports: [HasuraModule, AuthModule, NotificationsModule],
  controllers: [MerchantEngagementController],
  providers: [MerchantEngagementService, MerchantEngagementCronService],
  exports: [MerchantEngagementService],
})
export class MerchantEngagementModule {}
