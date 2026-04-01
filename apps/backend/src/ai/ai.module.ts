import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { DeepseekService } from './deepseek.service';
import { BusinessImagesModule } from '../business-images/business-images.module';
import { BusinessItemsModule } from '../business-items/business-items.module';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    forwardRef(() => BusinessImagesModule),
    forwardRef(() => BusinessItemsModule),
  ],
  controllers: [AiController],
  providers: [DeepseekService, AiService],
  exports: [AiService],
})
export class AiModule {}
