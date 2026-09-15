import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ReelAiReviewInternalController } from './reel-ai-review-internal.controller';
import { ReelAiReviewModelService } from './reel-ai-review-model.service';
import { ReelAiReviewQueueService } from './reel-ai-review-queue.service';
import { ReelAiReviewService } from './reel-ai-review.service';

@Module({
  imports: [HasuraModule, AiGenerationModule],
  controllers: [ReelAiReviewInternalController],
  providers: [
    ReelAiReviewQueueService,
    ReelAiReviewModelService,
    ReelAiReviewService,
  ],
  exports: [ReelAiReviewService],
})
export class ReelAiReviewModule {}
