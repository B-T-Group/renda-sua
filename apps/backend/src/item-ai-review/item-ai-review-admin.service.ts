import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ItemActivationValidationService } from '../image-validation/item-activation-validation.service';
import { MerchantLifecycleService } from '../merchant-lifecycle/merchant-lifecycle.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ItemAiReviewService } from './item-ai-review.service';
import * as Q from './item-ai-review.queries';
import {
  AiReviewFeedbackDto,
  AiReviewOverrideDto,
} from './dto/item-ai-review.dto';

@Injectable()
export class ItemAiReviewAdminService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly reviewService: ItemAiReviewService,
    private readonly notifications: NotificationsService,
    private readonly activationValidation: ItemActivationValidationService,
    private readonly merchantLifecycleService: MerchantLifecycleService
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
      item_ai_reviews: any[];
      item_ai_reviews_aggregate: {
        aggregate: { count: number } | null;
      };
    }>(Q.AI_REVIEWS_ADMIN_LIST, { where, limit, offset });
    const total = result.item_ai_reviews_aggregate?.aggregate?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      reviews: result.item_ai_reviews ?? [],
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
      item_ai_reviews_by_pk: any | null;
    }>(Q.AI_REVIEW_BY_PK, { id: reviewId });
    if (!r.item_ai_reviews_by_pk) {
      throw new HttpException('Review not found', HttpStatus.NOT_FOUND);
    }
    return r.item_ai_reviews_by_pk;
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
    const itemStatus = review.item?.moderation_status;
    if (itemStatus === 'draft') {
      throw new HttpException(
        'Cannot override AI review for a draft item',
        HttpStatus.BAD_REQUEST
      );
    }
    await this.hasura.executeMutation(Q.SET_AI_REVIEW_OVERRIDE, {
      id: reviewId,
      action: dto.action,
    });
    if (dto.action === 'force_approve') {
      await this.forceApprove(review, adminUserId);
    } else if (dto.action === 'force_reject') {
      await this.forceReject(review, adminUserId, dto.reason);
    } else {
      await this.forceRequeue(review.item_id);
    }
    return { success: true };
  }

  private buildWhere(params: {
    status?: string;
    adminFeedback?: string;
    promptVersion?: string;
  }): Record<string, unknown> {
    const and: Record<string, unknown>[] = [{ status: { _neq: 'running' } }];
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
    await this.activationValidation.assertItemCanActivateAsSystem(
      review.item_id
    );
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.APPLY_ITEM_MODERATION, {
      id: review.item_id,
      status: 'approved',
      isActive: true,
      moderatedAt: now,
      moderatorId: adminUserId,
      source: 'admin',
      aiReviewedAt: null,
    });
    const item = review.item;
    if (item?.business?.user_id) {
      await this.notifications.sendSaleItemApprovedEmail({
        itemId: review.item_id,
        itemName: item.name,
        businessUserId: item.business.user_id,
      });
    }
    if (item?.business?.id) {
      await this.merchantLifecycleService.recompute(
        item.business.id,
        'item_admin_approved'
      );
    }
  }

  private async forceReject(
    review: any,
    adminUserId: string,
    reason?: string
  ): Promise<void> {
    const trimmed =
      reason?.trim() ||
      'An admin reversed the AI decision. Please update your product.';
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.APPLY_ITEM_MODERATION, {
      id: review.item_id,
      status: 'rejected',
      isActive: false,
      moderatedAt: now,
      moderatorId: adminUserId,
      source: 'admin',
      aiReviewedAt: null,
    });
    const item = review.item;
    if (item?.business?.user_id) {
      await this.hasura.executeMutation(Q.INSERT_OWNER_MESSAGE, {
        userId: item.business.user_id,
        itemId: review.item_id,
        message: trimmed,
      });
      await this.notifications.sendSaleItemRejectedEmail({
        itemId: review.item_id,
        itemName: item.name,
        businessUserId: item.business.user_id,
        rejectionReason: trimmed,
      });
    }
  }

  private async forceRequeue(itemId: string): Promise<void> {
    await this.hasura.executeMutation(Q.RESET_ITEM_PENDING, { id: itemId });
    await this.reviewService.requestReview(itemId);
  }
}
