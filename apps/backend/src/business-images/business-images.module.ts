import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { ItemAiReviewModule } from '../item-ai-review/item-ai-review.module';
import { BusinessImagesController } from './business-images.controller';
import { BusinessImagesService } from './business-images.service';

@Module({
  imports: [AiGenerationModule, ItemAiReviewModule],
  controllers: [BusinessImagesController],
  providers: [BusinessImagesService],
  exports: [BusinessImagesService],
})
export class BusinessImagesModule {}
