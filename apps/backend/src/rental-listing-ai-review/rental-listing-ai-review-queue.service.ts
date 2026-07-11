import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';

@Injectable()
export class RentalListingAiReviewQueueService {
  private readonly logger = new Logger(RentalListingAiReviewQueueService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string | undefined;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    const region = awsConfig?.region || process.env.AWS_REGION || 'ca-central-1';
    this.sqsClient = new SQSClient({ region });
    this.queueUrl = this.resolveQueueUrl(awsConfig?.region);
    if (this.queueUrl) {
      this.logger.log(`Rental AI review queue: ${this.queueUrl}`);
    } else {
      this.logger.warn('Rental AI review queue URL not configured');
    }
  }

  /** @returns true when the message was accepted by SQS */
  async enqueueListingReview(
    listingId: string,
    reviewVersion: number
  ): Promise<boolean> {
    if (!this.queueUrl) {
      this.logger.warn(
        `Cannot enqueue AI review for ${listingId} — queue URL not configured`
      );
      return false;
    }
    const message = {
      eventType: 'listing.moderation.requested',
      listingId,
      reviewVersion,
      timestamp: new Date().toISOString(),
    };
    return this.sendMessage(message);
  }

  private resolveQueueUrl(region?: string): string | undefined {
    const explicit = process.env.RENTAL_LISTING_AI_REVIEW_QUEUE_URL;
    if (explicit) return explicit;
    const awsRegion = region || 'ca-central-1';
    const accountId = process.env.AWS_ACCOUNT_ID || '235680477887';
    const nodeEnv = process.env.NODE_ENV || 'development';
    const envName = nodeEnv === 'production' ? 'production' : 'development';
    return `https://sqs.${awsRegion}.amazonaws.com/${accountId}/rental-listing-ai-review-${envName}.fifo`;
  }

  private async sendMessage(message: Record<string, unknown>): Promise<boolean> {
    if (!this.queueUrl) return false;
    try {
      const input: SendMessageCommandInput = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageGroupId: 'rental-listing-ai-review',
      };
      const response = await this.sqsClient.send(new SendMessageCommand(input));
      this.logger.log(
        `Enqueued AI review for listing ${message.listingId} MessageId=${response.MessageId}`
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to enqueue AI review for ${message.listingId}: ${error?.message ?? error}`,
        error?.stack
      );
      return false;
    }
  }
}
