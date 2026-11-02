import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessItemsModule } from '../business-items/business-items.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { ItemAiReviewModule } from '../item-ai-review/item-ai-review.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SiteEventsModule } from '../site-events/site-events.module';
import { ItemAppealsController } from './item-appeals.controller';
import { ItemAppealsService } from './item-appeals.service';
import { ItemRejectionsModule } from './item-rejections.module';

@Module({
  imports: [
    AuthModule,
    HasuraModule,
    BusinessItemsModule,
    ItemAiReviewModule,
    ImageValidationModule,
    MerchantLifecycleModule,
    NotificationsModule,
    SiteEventsModule,
    ItemRejectionsModule,
  ],
  controllers: [ItemAppealsController],
  providers: [ItemAppealsService],
  exports: [ItemAppealsService],
})
export class ItemAppealsModule {}
