import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';
import {
  ThumbnailQueueMessage,
  ThumbnailSourceType,
} from './image-thumbnails.types';

type LocalHandler = (
  sourceType: ThumbnailSourceType,
  imageId: string
) => Promise<void>;

@Injectable()
export class ImageThumbnailsQueueService {
  private readonly logger = new Logger(ImageThumbnailsQueueService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string | undefined;
  private readonly localHandlers: LocalHandler[] = [];

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    const region =
      awsConfig?.region || process.env.AWS_REGION || 'ca-central-1';
    this.sqsClient = new SQSClient({ region });
    this.queueUrl = this.resolveQueueUrl(region);
    if (this.queueUrl) {
      this.logger.log(`Image thumbnails queue: ${this.queueUrl}`);
    } else {
      this.logger.warn('Image thumbnails queue URL not configured');
    }
  }

  registerLocalHandler(handler: LocalHandler): void {
    this.localHandlers.push(handler);
  }

  async enqueue(
    sourceType: ThumbnailSourceType,
    imageId: string
  ): Promise<boolean> {
    const preferInline =
      process.env.IMAGE_THUMBNAILS_INLINE === 'true' ||
      process.env.NODE_ENV === 'test';
    if (preferInline || !this.queueUrl) {
      this.runLocalHandlers(sourceType, imageId);
      return true;
    }
    const sent = await this.sendMessage(sourceType, imageId);
    if (!sent) {
      this.runLocalHandlers(sourceType, imageId);
    }
    return true;
  }

  private runLocalHandlers(
    sourceType: ThumbnailSourceType,
    imageId: string
  ): void {
    for (const handler of this.localHandlers) {
      void handler(sourceType, imageId).catch((error: any) => {
        this.logger.error(
          `Inline thumbnail generation failed for ${sourceType}/${imageId}: ${error?.message ?? error}`
        );
      });
    }
  }

  private resolveQueueUrl(region?: string): string | undefined {
    const explicit = process.env.IMAGE_THUMBNAILS_QUEUE_URL;
    if (explicit) return explicit;
    const awsRegion = region || 'ca-central-1';
    const accountId = process.env.AWS_ACCOUNT_ID || '235680477887';
    const nodeEnv = process.env.NODE_ENV || 'development';
    const envName = nodeEnv === 'production' ? 'production' : 'development';
    return `https://sqs.${awsRegion}.amazonaws.com/${accountId}/image-thumbnails-${envName}.fifo`;
  }

  private async sendMessage(
    sourceType: ThumbnailSourceType,
    imageId: string
  ): Promise<boolean> {
    if (!this.queueUrl) return false;
    try {
      const message: ThumbnailQueueMessage = {
        eventType: 'image.thumbnail.requested',
        sourceType,
        imageId,
        timestamp: new Date().toISOString(),
      };
      const input: SendMessageCommandInput = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        // Per-image group id: preserves per-image ordering without a global FIFO bottleneck
        MessageGroupId: `${sourceType}:${imageId}`,
      };
      const response = await this.sqsClient.send(new SendMessageCommand(input));
      this.logger.log(
        `Enqueued thumbnail for ${sourceType}/${imageId} MessageId=${response.MessageId}`
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to enqueue thumbnail for ${sourceType}/${imageId}: ${error?.message ?? error}`,
        error?.stack
      );
      return false;
    }
  }
}
