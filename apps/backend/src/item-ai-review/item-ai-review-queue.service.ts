import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';

@Injectable()
export class ItemAiReviewQueueService {
  private readonly logger = new Logger(ItemAiReviewQueueService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string | undefined;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    const region = awsConfig?.region || process.env.AWS_REGION || 'ca-central-1';
    this.sqsClient = new SQSClient({ region });
    this.queueUrl = this.resolveQueueUrl(awsConfig?.region);
    if (this.queueUrl) {
      this.logger.log(`Item AI review queue: ${this.queueUrl}`);
    } else {
      this.logger.warn('Item AI review queue URL not configured');
    }
  }

  /** @returns true when the message was accepted by SQS */
  async enqueueItemReview(
    itemId: string,
    reviewVersion: number
  ): Promise<boolean> {
    if (!this.queueUrl) {
      this.logger.warn(
        `Cannot enqueue AI review for ${itemId} — queue URL not configured`
      );
      return false;
    }
    const message = {
      eventType: 'item.moderation.requested',
      itemId,
      reviewVersion,
      timestamp: new Date().toISOString(),
    };
    return this.sendMessage(message);
  }

  private resolveQueueUrl(region?: string): string | undefined {
    const explicit = process.env.ITEM_AI_REVIEW_QUEUE_URL;
    if (explicit) return explicit;
    const awsRegion = region || 'ca-central-1';
    const accountId = process.env.AWS_ACCOUNT_ID || '235680477887';
    const nodeEnv = process.env.NODE_ENV || 'development';
    const envName = nodeEnv === 'production' ? 'production' : 'development';
    return `https://sqs.${awsRegion}.amazonaws.com/${accountId}/item-ai-review-${envName}.fifo`;
  }

  private async sendMessage(message: Record<string, unknown>): Promise<boolean> {
    if (!this.queueUrl) return false;
    try {
      const input: SendMessageCommandInput = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageGroupId: 'item-ai-review',
      };
      const response = await this.sqsClient.send(new SendMessageCommand(input));
      this.logger.log(
        `Enqueued AI review for item ${message.itemId} MessageId=${response.MessageId}`
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to enqueue AI review for ${message.itemId}: ${error?.message ?? error}`,
        error?.stack
      );
      return false;
    }
  }
}
