import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  ReelAiReviewModelService,
  type ReelReviewDecision,
  type ReelReviewInput,
} from './reel-ai-review-model.service';
import { REEL_AI_REVIEW_PROMPT_VERSION } from './reel-ai-review.prompt';
import { ReelAiReviewQueueService } from './reel-ai-review-queue.service';

@Injectable()
export class ReelAiReviewService {
  private readonly logger = new Logger(ReelAiReviewService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly config: ConfigService<Configuration>,
    private readonly queue: ReelAiReviewQueueService,
    private readonly model: ReelAiReviewModelService
  ) {}

  isEnabled(): boolean {
    return this.config.get('reelAiReview')?.enabled === true;
  }

  async requestReview(reelId: string): Promise<void> {
    if (!this.isEnabled()) return;
    const claimed = await this.hasura.executeMutation<{
      update_reels: { affected_rows: number };
    }>(
      `mutation($id:uuid!){update_reels(where:{id:{_eq:$id},moderation_status:{_eq:pending},processing_status:{_eq:ready}},_set:{moderation_status:ai_reviewing,updated_at:"now()"}){affected_rows}}`,
      { id: reelId }
    );
    if (!claimed.update_reels.affected_rows) return;
    if (!(await this.queue.enqueue(reelId))) await this.resetPending(reelId);
  }

  async runReview(reelId: string, reviewVersion = 1) {
    if (!this.isEnabled()) return { success: true, skipped: true };
    let reviewId: string | null = null;
    try {
      const reel = await this.loadReviewableReel(reelId);
      if (!reel) return { success: true, skipped: true };
      reviewId = await this.startReview(reelId, reviewVersion, reel);
      if (!reviewId) throw new Error('Failed to create reel AI review');
      const gate = this.preGate(reel);
      if (gate) {
        await this.deferToAdmin(reelId, reviewId, gate);
        return { success: true, skipped: true };
      }
      const decision = await this.model.review(reel);
      if (!decision.approve) {
        await this.deferToAdmin(reelId, reviewId, decision);
        return { success: true, skipped: true };
      }
      await this.autoApprove(reelId, reviewId, decision);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Reel AI review failed for ${reelId}: ${error?.message}`);
      if (reviewId) {
        await this.markReviewFailed(reviewId, error?.message || 'AI review failed');
      }
      await this.resetPending(reelId);
      return { success: false, error: error?.message || 'AI review failed' };
    }
  }

  private preGate(reel: ReelReviewInput): ReelReviewDecision | null {
    if (reel.processing_status && reel.processing_status !== 'ready') {
      return this.gateDecision('Processing not ready');
    }
    if (!reel.thumbnail_url) {
      return this.gateDecision('Missing thumbnail');
    }
    if (!reel.subject_type || !reel.subject_id) {
      return this.gateDecision('Missing subject');
    }
    return null;
  }

  private gateDecision(reason: string): ReelReviewDecision {
    return {
      approve: false,
      reason,
      raw: { decision: 'manual_review', reason, gated: true },
      model: 'pre-gate',
      showsProduct: false,
      policyClean: false,
      issues: ['pre_gate'],
    };
  }

  private async loadReviewableReel(
    reelId: string
  ): Promise<ReelReviewInput | null> {
    const result = await this.hasura.executeQuery<{
      reels_by_pk: (ReelReviewInput & {
        moderation_status: string;
        subject_id: string;
      }) | null;
    }>(
      `query($id:uuid!){reels_by_pk(id:$id){caption subject_type subject_id market_country thumbnail_url processing_status moderation_status}}`,
      { id: reelId }
    );
    const reel = result.reels_by_pk;
    if (!reel || reel.moderation_status !== 'ai_reviewing') return null;
    const product = await this.loadProductContext(
      reel.subject_type,
      reel.subject_id
    );
    return { ...reel, ...product };
  }

  private async loadProductContext(
    subjectType: string,
    subjectId: string
  ): Promise<{ product_name?: string | null; product_image_urls?: string[] }> {
    if (subjectType !== 'item') return {};
    const result = await this.hasura.executeQuery<{
      items_by_pk: {
        name: string;
        item_images: Array<{ image_url: string }>;
      } | null;
    }>(
      `query($id:uuid!){items_by_pk(id:$id){name item_images(order_by:{display_order:asc},limit:3){image_url}}}`,
      { id: subjectId }
    );
    const item = result.items_by_pk;
    if (!item) return {};
    return {
      product_name: item.name,
      product_image_urls: item.item_images.map((i) => i.image_url),
    };
  }

  private async startReview(
    reelId: string,
    reviewVersion: number,
    reel: ReelReviewInput
  ): Promise<string | null> {
    const result = await this.hasura.executeMutation<{
      insert_reel_ai_reviews_one: { id: string } | null;
    }>(
      `mutation($object:reel_ai_reviews_insert_input!){insert_reel_ai_reviews_one(object:$object){id}}`,
      {
        object: {
          reel_id: reelId,
          review_version: reviewVersion,
          prompt_version: REEL_AI_REVIEW_PROMPT_VERSION,
          input_snapshot: {
            reelId,
            subjectType: reel.subject_type,
            subjectId: reel.subject_id,
            productName: reel.product_name,
            hasThumbnail: !!reel.thumbnail_url,
          },
        },
      }
    );
    return result.insert_reel_ai_reviews_one?.id || null;
  }

  private async autoApprove(
    reelId: string,
    reviewId: string,
    decision: ReelReviewDecision
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation($reelId:uuid!,$reviewId:uuid!,$now:timestamptz!,$reason:String!,$raw:jsonb!,$modelMeta:jsonb!){update_reels(where:{id:{_eq:$reelId},moderation_status:{_eq:ai_reviewing}},_set:{moderation_status:approved,moderated_at:$now,published_at:$now,updated_at:$now}){affected_rows} update_reel_ai_reviews_by_pk(pk_columns:{id:$reviewId},_set:{status:approved,decision_reason:$reason,raw_model_response:$raw,model_meta:$modelMeta,completed_at:$now}){id}}`,
      {
        reelId,
        reviewId,
        now,
        reason: decision.reason,
        raw: decision.raw,
        modelMeta: {
          model: decision.model,
          showsProduct: decision.showsProduct,
          policyClean: decision.policyClean,
          issues: decision.issues,
        },
      }
    );
  }

  private async deferToAdmin(
    reelId: string,
    reviewId: string,
    decision: ReelReviewDecision
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$reason:String!,$raw:jsonb!,$modelMeta:jsonb!,$now:timestamptz!){update_reel_ai_reviews_by_pk(pk_columns:{id:$id},_set:{status:skipped,decision_reason:$reason,raw_model_response:$raw,model_meta:$modelMeta,completed_at:$now}){id}}`,
      {
        id: reviewId,
        reason: decision.reason,
        raw: decision.raw,
        modelMeta: {
          model: decision.model,
          showsProduct: decision.showsProduct,
          policyClean: decision.policyClean,
          issues: decision.issues,
        },
        now: new Date().toISOString(),
      }
    );
    await this.resetPending(reelId);
  }

  private async resetPending(reelId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($id:uuid!){update_reels(where:{id:{_eq:$id},moderation_status:{_eq:ai_reviewing}},_set:{moderation_status:pending,updated_at:"now()"}){affected_rows}}`,
      { id: reelId }
    );
  }

  private async markReviewFailed(reviewId: string, reason: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$reason:String!,$now:timestamptz!){update_reel_ai_reviews_by_pk(pk_columns:{id:$id},_set:{status:failed,decision_reason:$reason,completed_at:$now}){id}}`,
      { id: reviewId, reason, now: new Date().toISOString() }
    );
  }
}
