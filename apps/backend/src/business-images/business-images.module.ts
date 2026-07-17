import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { BusinessTokensModule } from '../business-tokens/business-tokens.module';
import { ImageThumbnailsModule } from '../image-thumbnails/image-thumbnails.module';
import { ItemAiReviewModule } from '../item-ai-review/item-ai-review.module';
import { BusinessImagesController } from './business-images.controller';
import { BusinessImagesService } from './business-images.service';

@Module({
  imports: [
    AiGenerationModule,
    ItemAiReviewModule,
    BusinessTokensModule,
    ImageThumbnailsModule,
  ],
  controllers: [BusinessImagesController],
  providers: [BusinessImagesService],
  exports: [BusinessImagesService],
})
export class BusinessImagesModule {}
