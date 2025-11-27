import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';

@Injectable()
export class OrderQueueService {
  private readonly logger = new Logger(OrderQueueService.name);
  private sqsClient: SQSClient;
  private queueUrl: string | undefined;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    this.sqsClient = new SQSClient({});

    // Build queue URL from template if not provided via environment variable
    const explicitQueueUrl = process.env.ORDER_STATUS_QUEUE_URL;
    if (explicitQueueUrl) {
      this.queueUrl = explicitQueueUrl;
    } else {
      // Build from template: https://sqs.{region}.amazonaws.com/{accountId}/order-status-changes-{env}.fifo
      const awsRegion = awsConfig?.region || 'ca-central-1';
      const awsAccountId = process.env.AWS_ACCOUNT_ID || '235680477887';
      const nodeEnv = process.env.NODE_ENV || 'development';
      // Map NODE_ENV to CDK environment name (production -> production, else -> development)
      const envName = nodeEnv === 'production' ? 'production' : 'development';

      this.queueUrl = `https://sqs.${awsRegion}.amazonaws.com/${awsAccountId}/order-status-changes-${envName}.fifo`;
    }

    if (!this.queueUrl) {
      this.logger.warn(
        'ORDER_STATUS_QUEUE_URL not configured. SQS messages will not be sent.'
      );
    } else {
      this.logger.log(`SQS Queue URL configured: ${this.queueUrl}`);
    }
  }

  /**
   * Send order.created message to SQS queue
   */
  async sendOrderCreatedMessage(orderId: string): Promise<void> {
    if (!this.queueUrl) {
      this.logger.debug('Skipping SQS message - queue URL not configured');
      return;
    }

    const message = {
      eventType: 'order.created',
      orderId,
      timestamp: new Date().toISOString(),
    };

    await this.sendMessage(message);
  }

  /**
   * Send order.completed message to SQS queue
   */
  async sendOrderCompletedMessage(orderId: string): Promise<void> {
    if (!this.queueUrl) {
      this.logger.debug('Skipping SQS message - queue URL not configured');
      return;
    }

    const message = {
      eventType: 'order.completed',
      orderId,
      timestamp: new Date().toISOString(),
    };

    await this.sendMessage(message);
  }

  /**
   * Send order.status.updated message to SQS queue
   */
  async sendOrderStatusUpdatedMessage(
    orderId: string,
    newStatus: string
  ): Promise<void> {
    if (!this.queueUrl) {
      this.logger.debug('Skipping SQS message - queue URL not configured');
      return;
    }

    const message = {
      eventType: 'order.status.updated',
      orderId,
      timestamp: new Date().toISOString(),
      status: newStatus,
    };

    await this.sendMessage(message);
  }

  /**
   * Send message to SQS FIFO queue
   */
  private async sendMessage(message: Record<string, unknown>): Promise<void> {
    if (!this.queueUrl) {
      return;
    }

    try {
      const messageBody = JSON.stringify(message);

      // For FIFO queues, use MessageGroupId (required) and MessageDeduplicationId (optional with content-based deduplication)
      const input: SendMessageCommandInput = {
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
        MessageGroupId: 'order-status-events', // All messages in same group for FIFO ordering
      };

      const command = new SendMessageCommand(input);
      const response = await this.sqsClient.send(command);

      this.logger.log(
        `Successfully sent ${message.eventType} message to SQS for order ${message.orderId}. MessageId: ${response.MessageId}`
      );
    } catch (error: unknown) {
      // Log error but don't throw - SQS failures shouldn't break order operations
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send ${message.eventType} message to SQS for order ${message.orderId}: ${errorMessage}`,
        errorStack
      );
    }
  }
}
