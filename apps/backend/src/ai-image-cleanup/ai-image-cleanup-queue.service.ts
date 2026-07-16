import { Injectable, Logger } from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';

@Injectable()
export class AiImageCleanupQueueService {
  private readonly logger = new Logger(AiImageCleanupQueueService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string | undefined;
  private readonly localHandlers: Array<(jobId: string) => Promise<void>> = [];

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    const region = awsConfig?.region || process.env.AWS_REGION || 'ca-central-1';
    this.sqsClient = new SQSClient({ region });
    this.queueUrl = this.resolveQueueUrl(region);
    if (this.queueUrl) {
      this.logger.log(`AI image cleanup queue: ${this.queueUrl}`);
    } else {
      this.logger.warn('AI image cleanup queue URL not configured');
    }
  }

  registerLocalHandler(handler: (jobId: string) => Promise<void>): void {
    this.localHandlers.push(handler);
  }

  async enqueueJob(jobId: string): Promise<boolean> {
    const preferInline =
      process.env.AI_IMAGE_CLEANUP_INLINE === 'true' ||
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'development';
    if (preferInline || !this.queueUrl) {
      this.runLocalHandlers(jobId);
      return true;
    }
    const sent = await this.sendMessage(jobId);
    if (!sent) {
      this.runLocalHandlers(jobId);
    }
    return true;
  }

  private runLocalHandlers(jobId: string): void {
    for (const handler of this.localHandlers) {
      void handler(jobId).catch((error: any) => {
        this.logger.error(
          `Inline AI cleanup failed for ${jobId}: ${error?.message ?? error}`
        );
      });
    }
  }

  private resolveQueueUrl(region?: string): string | undefined {
    const explicit = process.env.AI_IMAGE_CLEANUP_QUEUE_URL;
    if (explicit) return explicit;
    const awsRegion = region || 'ca-central-1';
    const accountId = process.env.AWS_ACCOUNT_ID || '235680477887';
    const nodeEnv = process.env.NODE_ENV || 'development';
    const envName = nodeEnv === 'production' ? 'production' : 'development';
    return `https://sqs.${awsRegion}.amazonaws.com/${accountId}/ai-image-cleanup-${envName}.fifo`;
  }

  private async sendMessage(jobId: string): Promise<boolean> {
    if (!this.queueUrl) return false;
    try {
      const input: SendMessageCommandInput = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({
          eventType: 'ai_image_cleanup.requested',
          jobId,
          timestamp: new Date().toISOString(),
        }),
        MessageGroupId: 'ai-image-cleanup',
      };
      const response = await this.sqsClient.send(new SendMessageCommand(input));
      this.logger.log(
        `Enqueued AI cleanup job ${jobId} MessageId=${response.MessageId}`
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to enqueue AI cleanup ${jobId}: ${error?.message ?? error}`,
        error?.stack
      );
      return false;
    }
  }
}
