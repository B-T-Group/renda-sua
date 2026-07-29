import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { Configuration } from '../config/configuration';

@Injectable()
export class AdminBroadcastQueueService {
  private readonly logger = new Logger(AdminBroadcastQueueService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string | undefined;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    const region = awsConfig?.region || process.env.AWS_REGION || 'ca-central-1';
    this.sqsClient = new SQSClient({ region });
    this.queueUrl = this.resolveQueueUrl(region);
    if (this.queueUrl) {
      this.logger.log(`Admin broadcast queue: ${this.queueUrl}`);
    } else {
      this.logger.warn('Admin broadcast queue URL not configured');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.queueUrl);
  }

  async enqueueCampaign(
    campaignId: string,
    afterUserId?: string | null
  ): Promise<boolean> {
    if (!this.queueUrl) return false;
    const message = {
      eventType: 'admin.broadcast.process',
      campaignId,
      afterUserId: afterUserId || undefined,
      timestamp: new Date().toISOString(),
    };
    try {
      const input: SendMessageCommandInput = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageGroupId: 'admin-broadcast',
        // Unique per enqueue so chunked resume is not dropped by FIFO 5-min dedupe.
        MessageDeduplicationId: `${campaignId}-${afterUserId || 'start'}-${Date.now()}`,
      };
      const response = await this.sqsClient.send(new SendMessageCommand(input));
      this.logger.log(
        `Enqueued broadcast ${campaignId} after=${afterUserId || 'start'} MessageId=${response.MessageId}`
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to enqueue broadcast ${campaignId}: ${error?.message ?? error}`,
        error?.stack
      );
      return false;
    }
  }

  private resolveQueueUrl(region?: string): string | undefined {
    const explicit = process.env.ADMIN_BROADCAST_QUEUE_URL;
    if (explicit) return explicit;
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      return undefined;
    }
    const awsRegion = region || 'ca-central-1';
    const accountId = process.env.AWS_ACCOUNT_ID || '235680477887';
    const nodeEnv = process.env.NODE_ENV || 'development';
    const envName = nodeEnv === 'production' ? 'production' : 'development';
    return `https://sqs.${awsRegion}.amazonaws.com/${accountId}/admin-broadcast-${envName}.fifo`;
  }
}
