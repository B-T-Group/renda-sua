import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { RentalItemImagesController } from './rental-item-images.controller';
import { RentalItemImagesService } from './rental-item-images.service';

@Module({
  imports: [AiGenerationModule],
  controllers: [RentalItemImagesController],
  providers: [RentalItemImagesService],
  exports: [RentalItemImagesService],
})
export class RentalItemImagesModule {}
