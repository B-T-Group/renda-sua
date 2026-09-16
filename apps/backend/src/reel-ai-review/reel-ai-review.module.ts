import { Module, forwardRef } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ReelsModule } from '../reels/reels.module';
import { ReelAiReviewAdminService } from './reel-ai-review-admin.service';
import { ReelAiReviewInternalController } from './reel-ai-review-internal.controller';
import { ReelAiReviewModelService } from './reel-ai-review-model.service';
import { ReelAiReviewQueueService } from './reel-ai-review-queue.service';
import { ReelAiReviewService } from './reel-ai-review.service';

@Module({
  imports: [HasuraModule, AiGenerationModule, forwardRef(() => ReelsModule)],
  controllers: [ReelAiReviewInternalController],
  providers: [
    ReelAiReviewQueueService,
    ReelAiReviewModelService,
    ReelAiReviewService,
    ReelAiReviewAdminService,
  ],
  exports: [ReelAiReviewService, ReelAiReviewAdminService],
})
export class ReelAiReviewModule {}
