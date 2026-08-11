import { Module } from '@nestjs/common';
import { ConfigurationsService } from '../admin/configurations.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralPyramidService } from './referral-pyramid.service';

@Module({
  imports: [NotificationsModule],
  providers: [ReferralPyramidService, ConfigurationsService],
  exports: [ReferralPyramidService],
})
export class ReferralsModule {}
