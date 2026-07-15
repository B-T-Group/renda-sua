import {
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';

export type CommerceQueueMessage =
  | {
      type: 'webhook';
      provider: 'shopify';
      eventId: string;
      topic: string;
      shopDomain?: string;
      integrationId?: string;
      payload: unknown;
    }
  | {
      type: 'reconcile';
      integrationId: string;
      trigger: 'MANUAL_SYNC' | 'RECONCILIATION';
    }
  | {
      type: 'outbound_inventory';
      integrationId: string;
      orderId: string;
      orderItemId: string;
      externalInventoryItemId: string;
      externalLocationId: string;
      delta: number;
      idempotencyKey: string;
      action: 'commit' | 'release';
    };

@Injectable()
export class CommerceQueueService {
  private readonly logger = new Logger(CommerceQueueService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl?: string;
  private readonly localHandlers: Array<
    (message: CommerceQueueMessage) => Promise<void>
  > = [];

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    const region =
      awsConfig?.region || process.env.AWS_REGION || 'ca-central-1';
    this.sqsClient = new SQSClient({ region });

    const explicit = process.env.COMMERCE_SYNC_QUEUE_URL;
    if (explicit) {
      this.queueUrl = explicit;
    } else {
      const accountId = process.env.AWS_ACCOUNT_ID || '235680477887';
      const envName =
        process.env.NODE_ENV === 'production' ? 'production' : 'development';
      this.queueUrl = `https://sqs.${region}.amazonaws.com/${accountId}/commerce-sync-${envName}.fifo`;
    }
  }

  registerLocalHandler(
    handler: (message: CommerceQueueMessage) => Promise<void>
  ): void {
    this.localHandlers.push(handler);
  }

  async enqueue(message: CommerceQueueMessage): Promise<void> {
    const cfg = this.configService.get('commerceIntegrations');
    if (cfg?.processSyncInline || !this.queueUrl || process.env.NODE_ENV === 'test') {
      for (const handler of this.localHandlers) {
        await handler(message);
      }
      return;
    }

    try {
      const body = JSON.stringify(message);
      const groupId =
        message.type === 'reconcile' || message.type === 'outbound_inventory'
          ? message.integrationId
          : message.shopDomain || message.eventId;
      const dedupeId =
        message.type === 'webhook'
          ? message.eventId
          : message.type === 'outbound_inventory'
          ? message.idempotencyKey
          : `${message.type}-${message.integrationId}-${Date.now()}`;

      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: body,
          MessageGroupId: groupId,
          MessageDeduplicationId: dedupeId.slice(0, 128),
        })
      );
    } catch (error: any) {
      this.logger.warn(
        `SQS enqueue failed, falling back to inline: ${error?.message}`
      );
      for (const handler of this.localHandlers) {
        await handler(message);
      }
    }
  }
}
