import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';

@Injectable()
export class ReelMediaQueueService {
  private readonly client: SQSClient;

  constructor(private readonly config: ConfigService<Configuration>) {
    const region = this.config.get('aws')?.region || 'ca-central-1';
    this.client = new SQSClient({ region });
  }

  async enqueue(reelId: string, sourceS3Key: string): Promise<void> {
    const queueUrl = this.config.get('reels')?.mediaQueueUrl;
    if (!queueUrl) throw new ServiceUnavailableException('Reel media queue is not configured');
    try {
      await this.client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ reelId, sourceS3Key }),
          MessageGroupId: reelId,
        })
      );
    } catch (error: any) {
      throw new ServiceUnavailableException(
        error?.message || 'Failed to queue reel media'
      );
    }
  }
}
