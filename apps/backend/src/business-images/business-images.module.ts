import { Module } from '@nestjs/common';
import { BusinessImagesController } from './business-images.controller';
import { BusinessImagesService } from './business-images.service';

@Module({
  controllers: [BusinessImagesController],
  providers: [BusinessImagesService],
  exports: [BusinessImagesService],
})
export class BusinessImagesModule {}

