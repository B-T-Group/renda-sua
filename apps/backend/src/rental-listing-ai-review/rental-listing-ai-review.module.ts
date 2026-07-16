import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalListingAiProposalController } from './rental-listing-ai-proposal.controller';
import { RentalListingAiProposalService } from './rental-listing-ai-proposal.service';
import { RentalListingAiReviewAdminService } from './rental-listing-ai-review-admin.service';
import { RentalListingAiReviewInternalController } from './rental-listing-ai-review-internal.controller';
import { RentalListingAiReviewModelService } from './rental-listing-ai-review-model.service';
import { RentalListingAiReviewQueueService } from './rental-listing-ai-review-queue.service';
import { RentalListingAiReviewService } from './rental-listing-ai-review.service';

@Module({
  imports: [
    AuthModule,
    HasuraModule,
    NotificationsModule,
  ],
  controllers: [
    RentalListingAiReviewInternalController,
    RentalListingAiProposalController,
  ],
  providers: [
    RentalListingAiReviewQueueService,
    RentalListingAiReviewModelService,
    RentalListingAiReviewService,
    RentalListingAiProposalService,
    RentalListingAiReviewAdminService,
  ],
  exports: [
    RentalListingAiReviewService,
    RentalListingAiReviewAdminService,
    RentalListingAiProposalService,
  ],
})
export class RentalListingAiReviewModule {}
