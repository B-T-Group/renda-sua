import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BusinessImagesController } from './business-images.controller';
import { BusinessImagesService } from './business-images.service';

@Module({
  imports: [AiModule],
  controllers: [BusinessImagesController],
  providers: [BusinessImagesService],
  exports: [BusinessImagesService],
})
export class BusinessImagesModule {}

