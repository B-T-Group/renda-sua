import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RentalListingAiReviewModelService } from './rental-listing-ai-review-model.service';
import { RentalListingAiReviewQueueService } from './rental-listing-ai-review-queue.service';
import * as Q from './rental-listing-ai-review.queries';
import {
  AiReviewModelResult,
  ListingForAiReview,
  PROMPT_VERSION,
} from './rental-listing-ai-review.types';

@Injectable()
export class RentalListingAiReviewService {
  private readonly logger = new Logger(RentalListingAiReviewService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly queue: RentalListingAiReviewQueueService,
    private readonly model: RentalListingAiReviewModelService,
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  isEnabled(): boolean {
    return (
      this.configService.get('rentalAiReview')?.enabled === true ||
      process.env.RENTAL_AI_AUTO_REVIEW_ENABLED === 'true'
    );
  }

  async requestReview(listingId: string): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug(`AI review disabled; skip enqueue for ${listingId}`);
      return;
    }
    const claimed = await this.claimForReview(listingId);
    if (!claimed) return;
    const enqueued = await this.queue.enqueueListingReview(
      listingId,
      claimed.version
    );
    if (!enqueued) {
      await this.failToPendingIfAiReviewing(
        listingId,
        'SQS enqueue failed after claim',
        ''
      );
    }
  }

  async runReview(
    listingId: string,
    expectedVersion?: number
  ): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    if (!this.isEnabled()) return { success: true, skipped: true };
    try {
      await this.executeReview(listingId, expectedVersion);
      return { success: true };
    } catch (error: any) {
      if (this.isStaleOrConflict(error)) {
        this.logger.warn(
          `AI review skipped for ${listingId}: ${error?.message ?? error}`
        );
        return { success: true, skipped: true };
      }
      this.logger.error(
        `AI review failed for ${listingId}: ${error?.message ?? error}`,
        error?.stack
      );
      const listingName: string = error?.__listingName ?? '';
      await this.failToPendingIfAiReviewing(
        listingId,
        error?.message ?? 'AI review failed',
        listingName
      );
      return { success: false, error: error?.message ?? String(error) };
    }
  }

  private isStaleOrConflict(error: unknown): boolean {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return status === HttpStatus.CONFLICT || status === HttpStatus.NOT_FOUND;
    }
    return false;
  }

  private async claimForReview(
    listingId: string
  ): Promise<{ version: number } | null> {
    const result = await this.hasura.executeMutation<{
      update_rental_location_listings: {
        returning: Array<{ id: string; ai_review_version: number }>;
      };
    }>(Q.SET_LISTING_AI_REVIEWING, { id: listingId });
    const row = result.update_rental_location_listings?.returning?.[0];
    if (!row) {
      this.logger.warn(`Could not claim listing ${listingId} for AI review`);
      return null;
    }
    return { version: row.ai_review_version };
  }

  private async executeReview(
    listingId: string,
    expectedVersion?: number
  ): Promise<void> {
    const listing = await this.loadListing(listingId);
    try {
      this.assertReviewable(listing, expectedVersion);
      if (this.hasBlockingImageErrors(listing)) {
        await this.applyRejectDecision(
          listing,
          await this.createRunningReview(listing),
          this.hardBlockResult(listing),
          { provider: 'prefilter', model: 'validation_errors' }
        );
        return;
      }
      const reviewId = await this.createRunningReview(listing);
      const { result, modelMeta } = await this.model.reviewListing(listing);
      await this.applyDecision(listing, reviewId, result, modelMeta);
    } catch (err: any) {
      // Attach listing name so callers can include it in failure notifications
      if (err && typeof err === 'object') {
        err.__listingName = listing.rental_item?.name ?? '';
      }
      throw err;
    }
  }

  private assertReviewable(
    listing: ListingForAiReview,
    expectedVersion?: number
  ): void {
    if (listing.moderation_status !== 'ai_reviewing') {
      throw new HttpException(
        `Listing not in ai_reviewing (status=${listing.moderation_status})`,
        HttpStatus.CONFLICT
      );
    }
    if (
      expectedVersion != null &&
      listing.ai_review_version !== expectedVersion
    ) {
      throw new HttpException(
        'Stale AI review version',
        HttpStatus.CONFLICT
      );
    }
  }

  private hasBlockingImageErrors(listing: ListingForAiReview): boolean {
    return (listing.rental_item.rental_item_images ?? []).some((img) => {
      const errs = img.validation_errors;
      return Array.isArray(errs) && errs.length > 0;
    });
  }

  private hardBlockResult(listing: ListingForAiReview): AiReviewModelResult {
    return {
      decision: 'reject',
      reason:
        'One or more images failed quality/safety validation. Please upload different images.',
      issues: [
        {
          field: 'images',
          code: 'VALIDATION_ERRORS',
          message: 'Image validation errors present',
        },
      ],
      proposedTitle: null,
      proposedDescription: null,
      imageActions: (listing.rental_item.rental_item_images ?? []).map((img) => ({
        imageId: img.id,
        action: 'replace_required' as const,
        note: 'Failed validation',
      })),
    };
  }

  private async loadListing(listingId: string): Promise<ListingForAiReview> {
    const r = await this.hasura.executeQuery<{
      rental_location_listings_by_pk: ListingForAiReview | null;
    }>(Q.LISTING_FOR_AI_REVIEW, { id: listingId });
    const row = r.rental_location_listings_by_pk;
    if (!row || row.deleted_at) {
      throw new HttpException('Listing not found', HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async createRunningReview(listing: ListingForAiReview): Promise<string> {
    const snapshot = {
      title: listing.rental_item.name,
      description: listing.rental_item.description,
      images: (listing.rental_item.rental_item_images ?? []).map((i) => ({
        id: i.id,
        image_url: i.image_url,
        validation_errors: i.validation_errors,
        quality_score: i.quality_score,
      })),
    };
    const r = await this.hasura.executeMutation<{
      insert_rental_listing_ai_reviews_one: { id: string } | null;
    }>(Q.INSERT_AI_REVIEW_RUNNING, {
      listingId: listing.id,
      reviewVersion: listing.ai_review_version,
      promptVersion: PROMPT_VERSION,
      inputSnapshot: snapshot,
    });
    const id = r.insert_rental_listing_ai_reviews_one?.id;
    if (!id) throw new Error('Failed to create AI review row');
    return id;
  }

  private async applyDecision(
    listing: ListingForAiReview,
    reviewId: string,
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    if (result.decision === 'approve') {
      await this.applyApproveDecision(listing, reviewId, result, modelMeta);
      return;
    }
    if (result.decision === 'propose') {
      await this.applyProposeDecision(listing, reviewId, result, modelMeta);
      return;
    }
    await this.applyRejectDecision(listing, reviewId, result, modelMeta);
  }

  private async applyApproveDecision(
    listing: ListingForAiReview,
    reviewId: string,
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    await this.completeReview(reviewId, 'approved', result, modelMeta);
    const applied = await this.patchListingStatusIfAiReviewing(
      listing.id,
      'approved',
      'ai'
    );
    if (!applied) {
      this.logger.warn(
        `Skipped AI approve for ${listing.id}; listing left ai_reviewing`
      );
      return;
    }
    await this.notifications.sendRentalListingApprovedEmail({
      listingId: listing.id,
      businessUserId: listing.rental_item.business.user_id,
      rentalItemName: listing.rental_item.name,
    });
  }

  private async applyProposeDecision(
    listing: ListingForAiReview,
    reviewId: string,
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    await this.completeReview(reviewId, 'proposal', result, modelMeta);
    const applied = await this.patchListingStatusIfAiReviewing(
      listing.id,
      'proposal_pending',
      'ai'
    );
    if (!applied) {
      this.logger.warn(
        `Skipped AI proposal for ${listing.id}; listing left ai_reviewing`
      );
      return;
    }
    await this.notifyProposal(listing, result);
  }

  private async applyRejectDecision(
    listing: ListingForAiReview,
    reviewId: string,
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    await this.completeReview(reviewId, 'rejected', result, modelMeta);
    const applied = await this.patchListingStatusIfAiReviewing(
      listing.id,
      'rejected',
      'ai'
    );
    if (!applied) {
      this.logger.warn(
        `Skipped AI reject for ${listing.id}; listing left ai_reviewing`
      );
      return;
    }
    const reason = result.reason;
    await this.insertOwnerMessage(
      listing.rental_item.business.user_id,
      listing.id,
      reason
    );
    await this.notifications.sendRentalListingRejectedEmail({
      listingId: listing.id,
      businessUserId: listing.rental_item.business.user_id,
      rentalItemName: listing.rental_item.name,
      rejectionReason: reason,
    });
  }

  private async completeReview(
    reviewId: string,
    status: 'approved' | 'proposal' | 'rejected' | 'failed',
    result: AiReviewModelResult,
    modelMeta: Record<string, unknown>
  ): Promise<void> {
    const rejectionFields = [
      ...new Set(result.issues.map((i) => i.field).filter(Boolean)),
    ];
    await this.hasura.executeMutation(Q.COMPLETE_AI_REVIEW, {
      id: reviewId,
      status,
      decisionReason: result.reason,
      alignmentScore: result.alignmentScore ?? null,
      rubric: result.rubric ?? null,
      rawModelResponse: result,
      proposedTitle: result.proposedTitle,
      proposedDescription: result.proposedDescription,
      rejectionFields,
      modelMeta,
      completedAt: new Date().toISOString(),
    });
  }

  private async patchListingStatusIfAiReviewing(
    listingId: string,
    status: string,
    source: string
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.hasura.executeMutation<{
      update_rental_location_listings: {
        affected_rows: number;
      };
    }>(Q.APPLY_LISTING_MODERATION_IF_AI_REVIEWING, {
      id: listingId,
      status,
      moderatedAt: now,
      source,
      aiReviewedAt: now,
    });
    return (result.update_rental_location_listings?.affected_rows ?? 0) > 0;
  }

  private async failToPendingIfAiReviewing(
    listingId: string,
    reason: string,
    listingName: string
  ): Promise<void> {
    try {
      const result = await this.hasura.executeMutation<{
        update_rental_location_listings: { affected_rows: number };
      }>(Q.RESET_LISTING_PENDING_IF_AI_REVIEWING, { id: listingId });
      const rows = result.update_rental_location_listings?.affected_rows ?? 0;
      if (rows > 0) {
        this.logger.warn(
          `AI review failed; listing ${listingId} back to pending: ${reason}`
        );
        await this.notifications.notifySuperusersListingAiReviewFailed({
          listingId,
          listingName: listingName || listingId,
          reason,
        });
      } else {
        this.logger.warn(
          `AI review failed for ${listingId} but status was no longer ai_reviewing; left unchanged (${reason})`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to reset listing ${listingId} after AI error: ${error?.message}`
      );
    }
  }

  private async insertOwnerMessage(
    userId: string,
    listingId: string,
    message: string
  ): Promise<void> {
    await this.hasura.executeMutation(Q.INSERT_OWNER_MESSAGE, {
      userId,
      listingId,
      message,
    });
  }

  private async notifyProposal(
    listing: ListingForAiReview,
    result: AiReviewModelResult
  ): Promise<void> {
    const summary = [
      result.proposedTitle ? `Suggested title: ${result.proposedTitle}` : null,
      result.proposedDescription ? 'Suggested description updates' : null,
      // Cleanup is merchant opt-in (consumes AI tokens); the review only
      // recommends it — it never generates cleaned images itself.
      result.imageActions.some((a) => a.action === 'cleanup')
        ? 'Photo cleanup recommended — you can run AI cleanup (uses tokens)'
        : null,
    ]
      .filter(Boolean)
      .join('. ');
    await this.insertOwnerMessage(
      listing.rental_item.business.user_id,
      listing.id,
      `AI suggested improvements for your listing. ${summary || result.reason}`
    );
    await this.notifications.sendRentalListingAiProposalEmail({
      listingId: listing.id,
      businessUserId: listing.rental_item.business.user_id,
      rentalItemName: listing.rental_item.name,
      proposalSummary: summary || result.reason,
    });
  }

}
