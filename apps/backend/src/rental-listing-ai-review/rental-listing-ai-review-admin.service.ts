import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RentalListingAiReviewService } from './rental-listing-ai-review.service';
import * as Q from './rental-listing-ai-review.queries';
import {
  AiReviewFeedbackDto,
  AiReviewOverrideDto,
} from './dto/rental-listing-ai-review.dto';

@Injectable()
export class RentalListingAiReviewAdminService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly reviewService: RentalListingAiReviewService,
    private readonly notifications: NotificationsService
  ) {}

  async listReviews(params: {
    status?: string;
    adminFeedback?: string;
    promptVersion?: string;
    page: number;
    limit: number;
  }) {
    const limit = Math.min(Math.max(params.limit, 1), 50);
    const page = Math.max(params.page, 1);
    const offset = (page - 1) * limit;
    const where = this.buildWhere(params);
    const result = await this.hasura.executeQuery<{
      rental_listing_ai_reviews: any[];
      rental_listing_ai_reviews_aggregate: {
        aggregate: { count: number } | null;
      };
    }>(Q.AI_REVIEWS_ADMIN_LIST, { where, limit, offset });
    const total =
      result.rental_listing_ai_reviews_aggregate?.aggregate?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      reviews: result.rental_listing_ai_reviews ?? [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getReview(reviewId: string) {
    const r = await this.hasura.executeQuery<{
      rental_listing_ai_reviews_by_pk: any | null;
    }>(Q.AI_REVIEW_BY_PK, { id: reviewId });
    if (!r.rental_listing_ai_reviews_by_pk) {
      throw new HttpException('Review not found', HttpStatus.NOT_FOUND);
    }
    return r.rental_listing_ai_reviews_by_pk;
  }

  async submitFeedback(
    reviewId: string,
    adminUserId: string,
    dto: AiReviewFeedbackDto
  ) {
    await this.getReview(reviewId);
    await this.hasura.executeMutation(Q.SET_AI_REVIEW_FEEDBACK, {
      id: reviewId,
      feedback: dto.feedback,
      notes: dto.notes?.trim() || null,
      userId: adminUserId,
      at: new Date().toISOString(),
    });
    return { success: true };
  }

  async override(
    reviewId: string,
    adminUserId: string,
    dto: AiReviewOverrideDto
  ) {
    const review = await this.getReview(reviewId);
    await this.hasura.executeMutation(Q.SET_AI_REVIEW_OVERRIDE, {
      id: reviewId,
      action: dto.action,
    });
    if (dto.action === 'force_approve') {
      await this.forceApprove(review, adminUserId);
    } else if (dto.action === 'force_reject') {
      await this.forceReject(review, adminUserId, dto.reason);
    } else {
      await this.forceRequeue(review.listing_id);
    }
    return { success: true };
  }

  private buildWhere(params: {
    status?: string;
    adminFeedback?: string;
    promptVersion?: string;
  }): Record<string, unknown> {
    const and: Record<string, unknown>[] = [
      { status: { _neq: 'running' } },
    ];
    const status = (params.status || 'all').toLowerCase();
    if (status !== 'all') {
      and.push({ status: { _eq: status } });
    }
    if (params.adminFeedback === 'agree' || params.adminFeedback === 'disagree') {
      and.push({ admin_feedback: { _eq: params.adminFeedback } });
    } else if (params.adminFeedback === 'none') {
      and.push({ admin_feedback: { _is_null: true } });
    }
    if (params.promptVersion?.trim()) {
      and.push({ prompt_version: { _eq: params.promptVersion.trim() } });
    }
    return { _and: and };
  }

  private async forceApprove(review: any, adminUserId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.APPLY_LISTING_MODERATION, {
      id: review.listing_id,
      status: 'approved',
      moderatedAt: now,
      moderatorId: adminUserId,
      source: 'admin',
      aiReviewedAt: null,
    });
    const item = review.listing?.rental_item;
    if (item?.business?.user_id) {
      await this.notifications.sendRentalListingApprovedEmail({
        listingId: review.listing_id,
        businessUserId: item.business.user_id,
        rentalItemName: item.name,
      });
    }
  }

  private async forceReject(
    review: any,
    adminUserId: string,
    reason?: string
  ): Promise<void> {
    const trimmed =
      reason?.trim() ||
      'An admin reversed the AI decision. Please update your listing.';
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.APPLY_LISTING_MODERATION, {
      id: review.listing_id,
      status: 'rejected',
      moderatedAt: now,
      moderatorId: adminUserId,
      source: 'admin',
      aiReviewedAt: null,
    });
    const item = review.listing?.rental_item;
    if (item?.business?.user_id) {
      await this.hasura.executeMutation(Q.INSERT_OWNER_MESSAGE, {
        userId: item.business.user_id,
        listingId: review.listing_id,
        message: trimmed,
      });
      await this.notifications.sendRentalListingRejectedEmail({
        listingId: review.listing_id,
        businessUserId: item.business.user_id,
        rentalItemName: item.name,
        rejectionReason: trimmed,
      });
    }
  }

  private async forceRequeue(listingId: string): Promise<void> {
    await this.hasura.executeMutation(Q.RESET_LISTING_PENDING, {
      id: listingId,
    });
    await this.reviewService.requestReview(listingId);
  }
}
