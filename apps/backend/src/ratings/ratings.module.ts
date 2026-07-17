import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RatingsController } from './ratings.controller';
import { RatingsCronService } from './ratings-cron.service';
import { RatingsService } from './ratings.service';

@Module({
  imports: [HasuraModule, NotificationsModule],
  controllers: [RatingsController],
  providers: [RatingsService, RatingsCronService],
  exports: [RatingsService],
})
export class RatingsModule {}
