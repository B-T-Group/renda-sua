import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { ReelAiReviewModule } from '../reel-ai-review/reel-ai-review.module';
import { ReelsModule } from '../reels/reels.module';
import { ReelMediaController } from './reel-media.controller';
import { ReelMediaService } from './reel-media.service';
import { ReelProcessingSweeperService } from './reel-processing-sweeper.service';

@Module({
  imports: [HasuraModule, ReelsModule, ReelAiReviewModule],
  controllers: [ReelMediaController],
  providers: [ReelMediaService, ReelProcessingSweeperService],
})
export class ReelMediaModule {}
