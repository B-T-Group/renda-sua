import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ReelMediaQueueService } from '../reels/reel-media-queue.service';

interface StuckReel {
  id: string;
  source_s3_key: string;
}

@Injectable()
export class ReelProcessingSweeperService {
  private readonly logger = new Logger(ReelProcessingSweeperService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly queue: ReelMediaQueueService
  ) {}

  @Cron('*/15 * * * *')
  async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const result = await this.hasura.executeQuery<{ reels: StuckReel[] }>(
      `query($cutoff:timestamptz!){reels(where:{processing_status:{_in:[queued,processing]},updated_at:{_lt:$cutoff}},limit:50){id source_s3_key}}`,
      { cutoff }
    );
    for (const reel of result.reels) await this.requeue(reel);
  }

  private async requeue(reel: StuckReel): Promise<void> {
    try {
      await this.hasura.executeMutation(
        `mutation($id:uuid!){update_reels_by_pk(pk_columns:{id:$id},_set:{processing_status:queued,updated_at:"now()"}){id}}`,
        { id: reel.id }
      );
      await this.queue.enqueue(reel.id, reel.source_s3_key);
    } catch (error: any) {
      this.logger.error(`Failed to requeue reel ${reel.id}: ${error?.message}`);
    }
  }
}
