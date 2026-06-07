import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { BusinessImagesController } from './business-images.controller';
import { BusinessImagesService } from './business-images.service';

@Module({
  imports: [AiGenerationModule],
  controllers: [BusinessImagesController],
  providers: [BusinessImagesService],
  exports: [BusinessImagesService],
})
export class BusinessImagesModule {}
