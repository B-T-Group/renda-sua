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
    this.sqsClient = new SQSClient({
      region: awsConfig?.region || 'us-east-1',
      credentials: {
        accessKeyId: awsConfig?.accessKeyId || '',
        secretAccessKey: awsConfig?.secretAccessKey || '',
      },
    });

    // Get queue URL from environment variable
    this.queueUrl = process.env.ORDER_STATUS_QUEUE_URL;

    if (!this.queueUrl) {
      this.logger.warn(
        'ORDER_STATUS_QUEUE_URL not configured. SQS messages will not be sent.'
      );
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
  private async sendMessage(message: Record<string, any>): Promise<void> {
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
    } catch (error: any) {
      // Log error but don't throw - SQS failures shouldn't break order operations
      this.logger.error(
        `Failed to send ${message.eventType} message to SQS for order ${message.orderId}: ${error.message}`,
        error.stack
      );
    }
  }
}
