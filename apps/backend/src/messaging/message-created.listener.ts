import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { MessageCreatedEvent } from './messaging.types';

@Injectable()
export class MessageCreatedListener {
  private readonly logger = new Logger(MessageCreatedListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  @OnEvent('message.created')
  async handleMessageCreated(event: MessageCreatedEvent): Promise<void> {
    try {
      await this.notifyRecipients(event);
    } catch (error: any) {
      this.logger.warn(
        `MessageCreatedListener failed for message ${event.messageId}: ${
          error?.message ?? String(error)
        }`
      );
    }
  }

  private async notifyRecipients(event: MessageCreatedEvent): Promise<void> {
    const recipients = await this.fetchUnnotifiedRecipients(event.messageId);

    await Promise.all(
      recipients.map((recipient) =>
        this.notifyRecipient(event, recipient).catch((err: any) =>
          this.logger.warn(
            `Failed to notify ${recipient.recipient_user_id} for message ${event.messageId}: ${err?.message}`
          )
        )
      )
    );
  }

  private async notifyRecipient(
    event: MessageCreatedEvent,
    recipient: { id: string; recipient_user_id: string; recipient_type: string }
  ): Promise<void> {
    if (event.messageType === 'DELIVERY_PIN') {
      await this.notificationsService.sendDeliveryPinSharedPush({
        recipientUserId: recipient.recipient_user_id,
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        senderName: event.senderName,
        messageId: event.messageId,
        fulfillmentMethod: event.fulfillmentMethod,
      });
    } else if (recipient.recipient_type === 'mentioned') {
      await this.notificationsService.sendMentionPush({
        recipientUserId: recipient.recipient_user_id,
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        senderName: event.senderName,
        messageId: event.messageId,
      });
    } else {
      await this.notificationsService.sendNewOrderMessagePush({
        recipientUserId: recipient.recipient_user_id,
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        senderName: event.senderName,
        messageId: event.messageId,
      });
    }

    await this.markRecipientNotified(recipient.id);
  }

  private async fetchUnnotifiedRecipients(messageId: string): Promise<
    Array<{ id: string; recipient_user_id: string; recipient_type: string }>
  > {
    const query = `
      query GetUnnotifiedRecipients($messageId: uuid!) {
        message_recipients(
          where: {
            message_id: { _eq: $messageId }
            notified_at: { _is_null: true }
          }
        ) {
          id
          recipient_user_id
          recipient_type
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery<{
      message_recipients: Array<{
        id: string;
        recipient_user_id: string;
        recipient_type: string;
      }>;
    }>(query, { messageId });

    return result.message_recipients ?? [];
  }

  private async markRecipientNotified(recipientId: string): Promise<void> {
    const mutation = `
      mutation MarkRecipientNotified($id: uuid!, $notifiedAt: timestamptz!) {
        update_message_recipients_by_pk(
          pk_columns: { id: $id }
          _set: { notified_at: $notifiedAt }
        ) {
          id
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      id: recipientId,
      notifiedAt: new Date().toISOString(),
    });
  }
}
