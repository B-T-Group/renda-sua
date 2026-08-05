import { Module } from '@nestjs/common';
import { AwsModule } from '../aws/aws.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServicesModule } from '../services/services.module';
import { IdDocumentAiReviewModelService } from './id-document-ai-review-model.service';
import { IdDocumentAiReviewService } from './id-document-ai-review.service';
import { IdDocumentAiReviewSweeperService } from './id-document-ai-review-sweeper.service';

@Module({
  imports: [HasuraModule, AwsModule, NotificationsModule, ServicesModule],
  providers: [
    IdDocumentAiReviewModelService,
    IdDocumentAiReviewService,
    IdDocumentAiReviewSweeperService,
  ],
  exports: [IdDocumentAiReviewService],
})
export class IdDocumentAiReviewModule {}
