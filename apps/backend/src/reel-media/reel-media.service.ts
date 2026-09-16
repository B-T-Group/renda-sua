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
    const domain = this.config.get('reels')?.cloudFrontDomain?.replace(/^https?:\/\//, '');
    await this.hasura.executeMutation(
      `mutation($id:uuid!,$changes:reels_set_input!){update_reels_by_pk(pk_columns:{id:$id},_set:$changes){id}}`,
      {
        id: reelId,
        changes: {
          processing_status: result.status,
          processed_s3_key: result.processedS3Key || null,
          thumbnail_s3_key: result.thumbnailS3Key || null,
          video_url: this.cdnUrl(domain, result.processedS3Key),
          thumbnail_url: this.cdnUrl(domain, result.thumbnailS3Key),
          duration_ms: result.durationMs || null,
          width: result.width || null,
          height: result.height || null,
          processing_error: result.error || null,
          updated_at: new Date().toISOString(),
        },
      }
    );
    if (ready) await this.aiReview.requestReview(reelId);
  }

  private cdnUrl(domain?: string, key?: string): string | null {
    return domain && key ? `https://${domain}/${key}` : null;
  }
}
