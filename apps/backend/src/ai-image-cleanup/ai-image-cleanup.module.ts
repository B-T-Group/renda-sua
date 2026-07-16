import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { AuthModule } from '../auth/auth.module';
import { AwsModule } from '../aws/aws.module';
import { BusinessTokensModule } from '../business-tokens/business-tokens.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiImageCleanupController } from './ai-image-cleanup.controller';
import { AiImageCleanupInternalController } from './ai-image-cleanup-internal.controller';
import { AiImageCleanupQueueService } from './ai-image-cleanup-queue.service';
import { AiImageCleanupService } from './ai-image-cleanup.service';

@Module({
  imports: [
    AuthModule,
    HasuraModule,
    NotificationsModule,
    AiGenerationModule,
    AwsModule,
    BusinessTokensModule,
  ],
  controllers: [AiImageCleanupController, AiImageCleanupInternalController],
  providers: [AiImageCleanupQueueService, AiImageCleanupService],
  exports: [AiImageCleanupService],
})
export class AiImageCleanupModule {}
