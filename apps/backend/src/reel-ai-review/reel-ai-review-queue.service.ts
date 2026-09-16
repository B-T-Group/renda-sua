import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';

@Injectable()
export class ReelAiReviewQueueService {
  private readonly logger = new Logger(ReelAiReviewQueueService.name);
  private readonly client: SQSClient;

  constructor(private readonly config: ConfigService<Configuration>) {
    this.client = new SQSClient({
      region: this.config.get('aws')?.region || 'ca-central-1',
    });
  }

  async enqueue(reelId: string, reviewVersion = 1): Promise<boolean> {
    const queueUrl = this.config.get('reelAiReview')?.queueUrl;
    if (!queueUrl) return false;
    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ reelId, reviewVersion }),
          MessageGroupId: reelId,
        })
      );
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to queue reel ${reelId}: ${error?.message}`);
      return false;
    }
  }
}
