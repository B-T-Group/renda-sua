import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RentalItemImagesController } from './rental-item-images.controller';
import { RentalItemImagesService } from './rental-item-images.service';

@Module({
  imports: [forwardRef(() => AiModule)],
  controllers: [RentalItemImagesController],
  providers: [RentalItemImagesService],
  exports: [RentalItemImagesService],
})
export class RentalItemImagesModule {}
