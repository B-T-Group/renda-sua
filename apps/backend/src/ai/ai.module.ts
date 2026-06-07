import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessImagesModule } from '../business-images/business-images.module';
import { BusinessItemsModule } from '../business-items/business-items.module';
import { AiController } from './ai.controller';
import { AiGenerationModule } from './ai-generation.module';

@Module({
  imports: [
    AuthModule,
    AiGenerationModule,
    BusinessImagesModule,
    BusinessItemsModule,
  ],
  controllers: [AiController],
})
export class AiModule {}
