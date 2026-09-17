import { Module, forwardRef } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { AuthModule } from '../auth/auth.module';
import { AwsModule } from '../aws/aws.module';
import { CatalogCacheModule } from '../catalog-cache/catalog-cache.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReelAiReviewModule } from '../reel-ai-review/reel-ai-review.module';
import { ReelAiTokensModule } from '../reel-ai-tokens/reel-ai-tokens.module';
import { ReelMediaQueueService } from './reel-media-queue.service';
import { ReelsAdminController } from './reels-admin.controller';
import { ReelsController } from './reels.controller';
import { ReelsFeedController } from './reels-feed.controller';
import { ReelsFeedService } from './reels-feed.service';
import { ReelsService } from './reels.service';

@Module({
  imports: [
    AuthModule,
    AdminAuthModule,
    AwsModule,
    CatalogCacheModule,
    HasuraModule,
    NotificationsModule,
    ReelAiTokensModule,
    forwardRef(() => ReelAiReviewModule),
  ],
  controllers: [ReelsController, ReelsFeedController, ReelsAdminController],
  providers: [ReelsService, ReelsFeedService, ReelMediaQueueService],
  exports: [ReelsService, ReelsFeedService, ReelMediaQueueService],
})
export class ReelsModule {}
