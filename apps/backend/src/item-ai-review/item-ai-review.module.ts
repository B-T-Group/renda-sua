import { Module } from '@nestjs/common';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { AwsModule } from '../aws/aws.module';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ItemAiProposalController } from './item-ai-proposal.controller';
import { ItemAiProposalService } from './item-ai-proposal.service';
import { ItemAiReviewAdminService } from './item-ai-review-admin.service';
import { ItemAiReviewInternalController } from './item-ai-review-internal.controller';
import { ItemAiReviewModelService } from './item-ai-review-model.service';
import { ItemAiReviewQueueService } from './item-ai-review-queue.service';
import { ItemAiReviewService } from './item-ai-review.service';

@Module({
  imports: [
    AuthModule,
    HasuraModule,
    NotificationsModule,
    AiGenerationModule,
    AwsModule,
    ImageValidationModule,
    MerchantLifecycleModule,
  ],
  controllers: [ItemAiReviewInternalController, ItemAiProposalController],
  providers: [
    ItemAiReviewQueueService,
    ItemAiReviewModelService,
    ItemAiReviewService,
    ItemAiProposalService,
    ItemAiReviewAdminService,
  ],
  exports: [
    ItemAiReviewService,
    ItemAiReviewAdminService,
    ItemAiProposalService,
  ],
})
export class ItemAiReviewModule {}
