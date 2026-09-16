import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ReelAiReviewService } from '../reel-ai-review/reel-ai-review.service';

export interface ReelMediaResult {
  status: 'ready' | 'failed';
  processedS3Key?: string;
  thumbnailS3Key?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  error?: string;
}

@Injectable()
export class ReelMediaService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly config: ConfigService<Configuration>,
    private readonly aiReview: ReelAiReviewService
  ) {}

  async complete(reelId: string, result: ReelMediaResult): Promise<void> {
    const ready = result.status === 'ready';
    const now = new Date().toISOString();
    const isAi = await this.isAiGenerated(reelId);
    await this.writeProcessingResult(reelId, result, now);
    if (ready && isAi) {
      await this.tryAutoApprove(reelId, now);
      return;
    }
    if (ready) await this.aiReview.requestReview(reelId);
  }

  private async isAiGenerated(reelId: string): Promise<boolean> {
    const result = await this.hasura.executeQuery<{
      reels_by_pk: { generation_source: string | null } | null;
    }>(`query($id:uuid!){reels_by_pk(id:$id){generation_source}}`, { id: reelId });
    return result.reels_by_pk?.generation_source === 'ai';
  }

  private async writeProcessingResult(
    reelId: string,
    result: ReelMediaResult,
    now: string
  ): Promise<void> {
    const domain = this.config
      .get('reels')
      ?.cloudFrontDomain?.replace(/^https?:\/\//, '');
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$changes:reels_set_input!){
        update_reels_by_pk(pk_columns:{id:$id},_set:$changes){id}
      }`,
      { id: reelId, changes: this.processingFields(result, domain, now) }
    );
  }

  private async tryAutoApprove(reelId: string, now: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$now:timestamptz!,$reason:String!){
        update_reels(
          where:{
            id:{_eq:$id}
            generation_source:{_eq:ai}
            moderation_status:{_in:[pending,draft]}
          }
          _set:{
            moderation_status:approved
            moderated_at:$now
            published_at:$now
            moderation_reason:$reason
            updated_at:$now
          }
        ){affected_rows}
      }`,
      { id: reelId, now, reason: 'Auto-approved AI-generated reel' }
    );
  }

  private processingFields(
    result: ReelMediaResult,
    domain: string | undefined,
    now: string
  ): Record<string, unknown> {
    return {
      processing_status: result.status,
      processed_s3_key: result.processedS3Key || null,
      thumbnail_s3_key: result.thumbnailS3Key || null,
      video_url: this.cdnUrl(domain, result.processedS3Key),
      thumbnail_url: this.cdnUrl(domain, result.thumbnailS3Key),
      duration_ms: result.durationMs || null,
      width: result.width || null,
      height: result.height || null,
      processing_error: result.error || null,
      updated_at: now,
    };
  }

  private cdnUrl(domain?: string, key?: string): string | null {
    return domain && key ? `https://${domain}/${key}` : null;
  }
}
