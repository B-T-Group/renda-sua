import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  ReelAiReviewModelService,
  type ReelReviewInput,
} from './reel-ai-review-model.service';
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
    try {
      const reel = await this.loadReviewableReel(reelId);
      if (!reel) return { success: true, skipped: true };
      const reviewId = await this.startReview(reelId, reviewVersion);
      if (!reviewId) throw new Error('Failed to create reel AI review');
      const decision = await this.model.review(reel);
      if (!decision.approve) {
        await this.deferToAdmin(reelId, reviewId, decision);
        return { success: true, skipped: true };
      }
      await this.autoApprove(reelId, reviewId, decision);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Reel AI review failed for ${reelId}: ${error?.message}`);
      await this.resetPending(reelId);
      return { success: false, error: error?.message || 'AI review failed' };
    }
  }

  private async loadReviewableReel(
    reelId: string
  ): Promise<ReelReviewInput | null> {
    const result = await this.hasura.executeQuery<{
      reels_by_pk: (ReelReviewInput & { moderation_status: string }) | null;
    }>(
      `query($id:uuid!){reels_by_pk(id:$id){caption subject_type market_country thumbnail_url moderation_status}}`,
      { id: reelId }
    );
    return result.reels_by_pk?.moderation_status === 'ai_reviewing'
      ? result.reels_by_pk
      : null;
  }

  private async startReview(reelId: string, reviewVersion: number): Promise<string | null> {
    const result = await this.hasura.executeMutation<{
      insert_reel_ai_reviews_one: { id: string } | null;
    }>(
      `mutation($object:reel_ai_reviews_insert_input!){insert_reel_ai_reviews_one(object:$object){id}}`,
      {
        object: {
          reel_id: reelId,
          review_version: reviewVersion,
          input_snapshot: { reelId },
        },
      }
    );
    return result.insert_reel_ai_reviews_one?.id || null;
  }

  private async autoApprove(
    reelId: string,
    reviewId: string,
    decision: { reason: string; raw: unknown; model: string }
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
        modelMeta: { model: decision.model },
      }
    );
  }

  private async deferToAdmin(
    reelId: string,
    reviewId: string,
    decision: { reason: string; raw: unknown; model: string }
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$reason:String!,$raw:jsonb!,$modelMeta:jsonb!,$now:timestamptz!){update_reel_ai_reviews_by_pk(pk_columns:{id:$id},_set:{status:skipped,decision_reason:$reason,raw_model_response:$raw,model_meta:$modelMeta,completed_at:$now}){id}}`,
      {
        id: reviewId,
        reason: decision.reason,
        raw: decision.raw,
        modelMeta: { model: decision.model },
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
}
