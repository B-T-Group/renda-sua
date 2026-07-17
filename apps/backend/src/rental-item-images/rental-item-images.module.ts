import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { BusinessTokensModule } from '../business-tokens/business-tokens.module';
import { ImageThumbnailsModule } from '../image-thumbnails/image-thumbnails.module';
import { RentalItemImagesController } from './rental-item-images.controller';
import { RentalItemImagesService } from './rental-item-images.service';

@Module({
  imports: [AiGenerationModule, BusinessTokensModule, ImageThumbnailsModule],
  controllers: [RentalItemImagesController],
  providers: [RentalItemImagesService],
  exports: [RentalItemImagesService],
})
export class RentalItemImagesModule {}
