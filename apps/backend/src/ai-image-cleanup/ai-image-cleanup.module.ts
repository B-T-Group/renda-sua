import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { AuthModule } from '../auth/auth.module';
import { AwsModule } from '../aws/aws.module';
import { BusinessTokensModule } from '../business-tokens/business-tokens.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ImageThumbnailsModule } from '../image-thumbnails/image-thumbnails.module';
import { ItemAiReviewModule } from '../item-ai-review/item-ai-review.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalListingAiReviewModule } from '../rental-listing-ai-review/rental-listing-ai-review.module';
import { AiImageCleanupController } from './ai-image-cleanup.controller';
import { AiImageCleanupInternalController } from './ai-image-cleanup-internal.controller';
import { AiImageCleanupVariantController } from './ai-image-cleanup-variant.controller';
import { AiImageCleanupQueueService } from './ai-image-cleanup-queue.service';
import { AiImageCleanupService } from './ai-image-cleanup.service';
import { EnhancementConfidenceService } from './enhancement-confidence.service';
import { RembgCleanupService } from './rembg-cleanup.service';

@Module({
  imports: [
    AuthModule,
    HasuraModule,
    NotificationsModule,
    AiGenerationModule,
    AwsModule,
    BusinessTokensModule,
    ImageThumbnailsModule,
    ItemAiReviewModule,
    RentalListingAiReviewModule,
  ],
  controllers: [
    AiImageCleanupController,
    AiImageCleanupVariantController,
    AiImageCleanupInternalController,
  ],
  providers: [
    AiImageCleanupQueueService,
    AiImageCleanupService,
    EnhancementConfidenceService,
    RembgCleanupService,
  ],
  exports: [AiImageCleanupService],
})
export class AiImageCleanupModule {}
