import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { OrderContactRecipientType } from './dto/admin-orders.dto';

export interface OrderContactTarget {
  id: string;
  order_number: string;
  client?: { user_id?: string | null; user?: { id?: string | null } | null } | null;
  business?: { user_id?: string | null; user?: { id?: string | null } | null } | null;
  assigned_agent?: {
    user_id?: string | null;
    user?: { id?: string | null } | null;
  } | null;
}

const INSERT_ADMIN_ORDER_MESSAGE = `
  mutation CreateAdminOrderContactMessage(
    $userId: uuid!
    $orderId: uuid!
    $message: String!
  ) {
    insert_user_messages_one(
      object: {
        user_id: $userId
        entity_type: order
        entity_id: $orderId
        message: $message
      }
    ) {
      id
    }
  }
`;

const INSERT_ADMIN_ORDER_RECIPIENT = `
  mutation InsertAdminOrderContactRecipient(
    $objects: [message_recipients_insert_input!]!
  ) {
    insert_message_recipients(objects: $objects) {
      affected_rows
    }
  }
`;

@Injectable()
export class AdminOrderContactService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly notificationsService: NotificationsService
  ) {}

  async sendInAppMessage(params: {
    order: OrderContactTarget;
    message: string;
    recipientType: OrderContactRecipientType;
  }): Promise<{ id: string }> {
    const text = this.requireMessage(params.message);
    const recipientUserId = this.requireRecipientUserId(
      params.order,
      params.recipientType
    );
    const sender = await this.hasuraUserService.getUser();
    const created = await this.insertOrderMessage(
      sender.id,
      params.order.id,
      text
    );
    await this.insertRecipient(created.id, recipientUserId, params.recipientType);
    await this.notifyRecipient(params.order, sender, recipientUserId, created.id);
    return created;
  }

  private requireMessage(message: string): string {
    const text = message?.trim();
    if (!text) {
      throw new HttpException('Message cannot be empty', HttpStatus.BAD_REQUEST);
    }
    return text;
  }

  private requireRecipientUserId(
    order: OrderContactTarget,
    recipientType: OrderContactRecipientType
  ): string {
    const party =
      recipientType === 'client'
        ? order.client
        : recipientType === 'business'
          ? order.business
          : order.assigned_agent;
    const userId = party?.user_id ?? party?.user?.id ?? null;
    if (!userId) {
      throw new HttpException('Recipient not found', HttpStatus.BAD_REQUEST);
    }
    return userId;
  }

  private async insertOrderMessage(
    userId: string,
    orderId: string,
    message: string
  ): Promise<{ id: string }> {
    const result = await this.hasuraSystemService.executeMutation<{
      insert_user_messages_one: { id: string } | null;
    }>(INSERT_ADMIN_ORDER_MESSAGE, { userId, orderId, message });
    if (!result.insert_user_messages_one) {
      throw new HttpException(
        'Failed to send message',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return result.insert_user_messages_one;
  }

  private async insertRecipient(
    messageId: string,
    recipientUserId: string,
    recipientType: OrderContactRecipientType
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(INSERT_ADMIN_ORDER_RECIPIENT, {
      objects: [
        {
          message_id: messageId,
          recipient_user_id: recipientUserId,
          recipient_type: recipientType,
        },
      ],
    });
  }

  private async notifyRecipient(
    order: OrderContactTarget,
    sender: { first_name?: string | null; last_name?: string | null },
    recipientUserId: string,
    messageId: string
  ): Promise<void> {
    const senderName =
      `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() || 'Support';
    await this.notificationsService.sendNewOrderMessagePush({
      recipientUserId,
      orderId: order.id,
      orderNumber: order.order_number,
      senderName,
      messageId,
    });
  }
}
