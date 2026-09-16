import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ReelsService } from '../reels/reels.service';
import {
  ReelAiReviewFeedbackDto,
  ReelAiReviewOverrideDto,
} from './dto/reel-ai-review-admin.dto';
import * as Q from './reel-ai-review.queries';
import { ReelAiReviewService } from './reel-ai-review.service';

@Injectable()
export class ReelAiReviewAdminService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly reviewService: ReelAiReviewService,
    private readonly reels: ReelsService
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
      reel_ai_reviews: unknown[];
      reel_ai_reviews_aggregate: { aggregate: { count: number } | null };
    }>(Q.REEL_AI_REVIEWS_ADMIN_LIST, { where, limit, offset });
    const total = result.reel_ai_reviews_aggregate?.aggregate?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      reviews: result.reel_ai_reviews ?? [],
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
      reel_ai_reviews_by_pk: { reel_id: string; reel?: { moderation_status?: string } } | null;
    }>(Q.REEL_AI_REVIEW_BY_PK, { id: reviewId });
    if (!r.reel_ai_reviews_by_pk) {
      throw new HttpException('Review not found', HttpStatus.NOT_FOUND);
    }
    return r.reel_ai_reviews_by_pk;
  }

  async submitFeedback(
    reviewId: string,
    adminUserId: string,
    dto: ReelAiReviewFeedbackDto
  ) {
    await this.getReview(reviewId);
    await this.hasura.executeMutation(Q.SET_REEL_AI_REVIEW_FEEDBACK, {
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
    dto: ReelAiReviewOverrideDto
  ) {
    const review = await this.getReview(reviewId);
    await this.hasura.executeMutation(Q.SET_REEL_AI_REVIEW_OVERRIDE, {
      id: reviewId,
      action: dto.action,
    });
    if (dto.action === 'force_approve') {
      await this.reels.moderate(review.reel_id, adminUserId, {
        status: 'approved',
      });
    } else if (dto.action === 'force_reject') {
      await this.reels.moderate(review.reel_id, adminUserId, {
        status: 'rejected',
        reason:
          dto.reason?.trim() ||
          'An admin reversed the AI decision. Please update your reel.',
      });
    } else {
      await this.forceRequeue(review.reel_id);
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
    if (status === 'deferred') {
      and.push({ status: { _eq: 'skipped' } });
    } else if (status !== 'all') {
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

  private async forceRequeue(reelId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($id:uuid!){update_reels_by_pk(pk_columns:{id:$id},_set:{moderation_status:pending,updated_at:"now()"}){id}}`,
      { id: reelId }
    );
    await this.reviewService.requestReview(reelId);
  }
}
