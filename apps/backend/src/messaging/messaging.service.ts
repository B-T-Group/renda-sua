import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { Configuration } from '../config/configuration';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { RbacService } from '../rbac/rbac.service';
import type { PersonaId } from '../users/persona.types';
import { isActivePersona } from '../users/persona.util';
import { MentionValidationService } from './mention-validation.service';
import type {
  MessageCreatedEvent,
  MessagingOrder,
  MentionableParticipant,
  OrderMessage,
} from './messaging.types';
import { OrderParticipantsService } from './order-participants.service';
import { RecipientResolutionService } from './recipient-resolution.service';
import { StructuredMessageTypeRegistry } from './structured/structured-message.registry';
import type { MessageType } from './structured/structured-message.types';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly orderParticipantsService: OrderParticipantsService,
    private readonly mentionValidationService: MentionValidationService,
    private readonly recipientResolutionService: RecipientResolutionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService<Configuration>,
    private readonly notificationsService: NotificationsService,
    private readonly structuredMessageRegistry: StructuredMessageTypeRegistry,
    private readonly rbacService: RbacService
  ) {}

  async getOrderMessages(orderId: string): Promise<OrderMessage[]> {
    const user = await this.hasuraUserService.getUser();
    const order = await this.loadOrderForMessaging(orderId);
    await this.assertMessagingAccess(user, order);

    const query = `
      query GetOrderMessages($orderId: uuid!, $entityType: entity_types_enum!) {
        user_messages(
          where: {
            entity_id: { _eq: $orderId }
            entity_type: { _eq: $entityType }
          }
          order_by: { created_at: desc }
        ) {
          id
          user_id
          entity_type
          entity_id
          message
          message_type
          message_payload
          is_immutable
          created_at
          updated_at
          user {
            id
            email
            first_name
            last_name
          }
          entity_type_info {
            id
            comment
          }
          mentions {
            mentioned_user_id
            mentioned_persona
            text_offset
            text_length
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{
        id: string;
        user_id: string;
        entity_type: string;
        entity_id: string;
        message: string;
        message_type?: string;
        message_payload?: Record<string, unknown> | null;
        is_immutable?: boolean;
        created_at: string;
        updated_at: string;
        user?: { id: string; email: string; first_name: string; last_name: string };
        entity_type_info?: { id: string; comment: string };
        mentions?: Array<{
          mentioned_user_id: string;
          mentioned_persona: string;
          text_offset?: number | null;
          text_length?: number | null;
        }>;
      }>;
    }>(query, { orderId, entityType: 'order' });

    const messages = result.user_messages ?? [];

    const viewerPersona = this.resolvePersona(user, order);

    return messages.map((msg) =>
      this.enrichSingleMessage(msg, order, user.id, viewerPersona)
    );
  }

  async loadOrderForMessagingPublic(orderId: string): Promise<MessagingOrder> {
    return this.loadOrderForMessaging(orderId);
  }

  enrichSingleMessage(
    msg: {
      id: string;
      user_id: string;
      entity_type: string;
      entity_id: string;
      message: string;
      message_type?: string;
      message_payload?: Record<string, unknown> | null;
      is_immutable?: boolean;
      created_at: string;
      updated_at: string;
      user?: { id: string; email: string; first_name: string; last_name: string };
      entity_type_info?: { id: string; comment: string };
      mentions?: Array<{
        mentioned_user_id: string;
        mentioned_persona: string;
        text_offset?: number | null;
        text_length?: number | null;
      }>;
    },
    order: MessagingOrder,
    viewerUserId: string,
    viewerPersona: PersonaId
  ): OrderMessage {
    const participants = this.orderParticipantsService.getParticipants(order);

    const senderPersona =
      participants.find((p) => p.userId === msg.user_id)?.persona ?? undefined;

    const rawMention = msg.mentions?.[0];
    const mentionParticipant = rawMention
      ? participants.find((p) => p.userId === rawMention.mentioned_user_id)
      : undefined;

    const messageType = (msg.message_type ?? 'TEXT') as MessageType;
    const structuredContent = this.structuredMessageRegistry.enrichForViewer(
      messageType,
      msg.message_payload ?? null,
      { viewerUserId, viewerPersona, order }
    );

    return {
      id: msg.id,
      user_id: msg.user_id,
      entity_type: msg.entity_type,
      entity_id: msg.entity_id,
      message: msg.message,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      user: msg.user,
      entity_type_info: msg.entity_type_info,
      sender_persona: senderPersona,
      message_type: messageType,
      message_payload: msg.message_payload ?? null,
      is_immutable: msg.is_immutable ?? false,
      structured_content: structuredContent,
      mention: rawMention
        ? {
            mentionedUserId: rawMention.mentioned_user_id,
            persona: rawMention.mentioned_persona as PersonaId,
            displayName: mentionParticipant?.displayName ?? '',
            textOffset: rawMention.text_offset,
            textLength: rawMention.text_length,
          }
        : null,
    };
  }

  async createOrderMessage(
    orderId: string,
    message: string,
    mentionedUserId?: string
  ): Promise<OrderMessage> {
    const user = await this.hasuraUserService.getUser();
    const order = await this.loadOrderForMessaging(orderId);
    await this.assertMessagingAccess(user, order);

    if (!message?.trim()) {
      throw new HttpException('Message cannot be empty', HttpStatus.BAD_REQUEST);
    }

    const senderPersona = this.resolvePersona(user, order);

    if (mentionedUserId) {
      this.mentionValidationService.validateMention(
        order,
        user.id,
        senderPersona,
        mentionedUserId
      );
    }

    const insertMutation = `
      mutation CreateOrderMessage(
        $user_id: uuid!
        $entity_type: entity_types_enum!
        $entity_id: uuid!
        $message: String!
      ) {
        insert_user_messages_one(object: {
          user_id: $user_id
          entity_type: $entity_type
          entity_id: $entity_id
          message: $message
        }) {
          id
          user_id
          entity_type
          entity_id
          message
          created_at
          updated_at
          user {
            id
            email
            first_name
            last_name
          }
          entity_type_info {
            id
            comment
          }
        }
      }
    `;

    const insertResult = await this.hasuraSystemService.executeMutation<{
      insert_user_messages_one: {
        id: string;
        user_id: string;
        entity_type: string;
        entity_id: string;
        message: string;
        created_at: string;
        updated_at: string;
        user?: { id: string; email: string; first_name: string; last_name: string };
        entity_type_info?: { id: string; comment: string };
      } | null;
    }>(insertMutation, {
      user_id: user.id,
      entity_type: 'order',
      entity_id: order.id,
      message: message.trim(),
    });

    const created = insertResult.insert_user_messages_one;
    if (!created) {
      throw new HttpException(
        'Failed to create message',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    const participants = this.orderParticipantsService.getParticipants(order);

    if (mentionedUserId) {
      const mentionedParticipant = participants.find(
        (p) => p.userId === mentionedUserId
      );
      const mentionedPersona = mentionedParticipant?.persona ?? 'client';

      await this.insertMention(created.id, mentionedUserId, mentionedPersona);
    }

    const recipients = this.recipientResolutionService.resolve(
      order,
      senderPersona,
      mentionedUserId
    );

    await this.insertRecipients(created.id, recipients);

    const senderName =
      `${created.user?.first_name ?? ''} ${created.user?.last_name ?? ''}`.trim();

    const targetedRouting =
      this.configService.get<Configuration['messaging']>('messaging')
        ?.targetedRoutingEnabled ?? false;

    if (targetedRouting) {
      const event: MessageCreatedEvent = {
        messageId: created.id,
        orderId: order.id,
        orderNumber: order.order_number,
        senderUserId: user.id,
        senderPersona,
        senderName,
        mentionedUserId,
        recipients,
      };
      this.eventEmitter.emit('message.created', event);
    } else {
      // Legacy: broadcast push to all other participants
      await this.broadcastLegacyPush(order, user.id, senderName, created.id);
    }

    const mentionedParticipant = mentionedUserId
      ? participants.find((p) => p.userId === mentionedUserId)
      : undefined;

    return {
      id: created.id,
      user_id: created.user_id,
      entity_type: created.entity_type,
      entity_id: created.entity_id,
      message: created.message,
      created_at: created.created_at,
      updated_at: created.updated_at,
      user: created.user,
      entity_type_info: created.entity_type_info,
      sender_persona: senderPersona,
      mention: mentionedUserId
        ? {
            mentionedUserId,
            persona: mentionedParticipant?.persona ?? 'client',
            displayName: mentionedParticipant?.displayName ?? '',
          }
        : null,
    };
  }

  async getMentionableParticipants(
    orderId: string
  ): Promise<MentionableParticipant[]> {
    const user = await this.hasuraUserService.getUser();
    const order = await this.loadOrderForMessaging(orderId);
    await this.assertMessagingAccess(user, order);

    const senderPersona = this.resolvePersona(user, order);
    return this.orderParticipantsService.getMentionableParticipants(
      order,
      user.id,
      senderPersona
    );
  }

  async markMessagesRead(
    orderId: string,
    lastReadMessageId: string
  ): Promise<void> {
    const user = await this.hasuraUserService.getUser();
    const order = await this.loadOrderForMessaging(orderId);
    await this.assertMessagingAccess(user, order);

    const getMessagesQuery = `
      query GetMessagesUpTo($orderId: uuid!, $entityType: entity_types_enum!, $lastId: uuid!) {
        last_message: user_messages(
          where: { id: { _eq: $lastId } }
          limit: 1
        ) {
          created_at
        }
      }
    `;

    const lastMessageResult = await this.hasuraSystemService.executeQuery<{
      last_message: Array<{ created_at: string }>;
    }>(getMessagesQuery, {
      orderId,
      entityType: 'order',
      lastId: lastReadMessageId,
    });

    const lastCreatedAt = lastMessageResult.last_message?.[0]?.created_at;
    if (!lastCreatedAt) return;

    const getMessagesToMarkQuery = `
      query GetMessagesToMark($orderId: uuid!, $entityType: entity_types_enum!, $upTo: timestamptz!) {
        user_messages(
          where: {
            entity_id: { _eq: $orderId }
            entity_type: { _eq: $entityType }
            created_at: { _lte: $upTo }
          }
        ) {
          id
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{ id: string }>;
    }>(getMessagesToMarkQuery, {
      orderId,
      entityType: 'order',
      upTo: lastCreatedAt,
    });

    const messageIds = (result.user_messages ?? []).map((m) => m.id);
    if (messageIds.length === 0) return;

    const readObjects = messageIds.map((messageId) => ({
      message_id: messageId,
      user_id: user.id,
    }));

    const upsertMutation = `
      mutation MarkMessagesRead($objects: [message_reads_insert_input!]!) {
        insert_message_reads(
          objects: $objects
          on_conflict: { constraint: uq_message_reads_message_user, update_columns: [] }
        ) {
          affected_rows
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(upsertMutation, {
      objects: readObjects,
    });
  }

  /**
   * Assert that the current user has access to the order's message thread.
   * Throws 403 if not authorized.
   */
  async assertMessagingAccess(
    user: {
      id: string;
      business?: { id?: string } | null;
      agent?: { id?: string } | null;
      user_type_id?: string | null;
    },
    order: MessagingOrder
  ): Promise<void> {
    let hasAccess = false;

    if (isActivePersona(user, 'business') && user.business) {
      if (order.business_id === user.business.id) {
        hasAccess = true;
      } else if (
        await this.rbacService.hasPermission(
          user.id,
          PlatformPermissions.ORDERS_CROSS_BUSINESS
        )
      ) {
        hasAccess = true;
      }
    } else if (
      isActivePersona(user, 'client') &&
      order.client?.user_id === user.id
    ) {
      hasAccess = true;
    } else if (
      isActivePersona(user, 'agent') &&
      user.agent &&
      (order.assigned_agent_id === user.agent.id ||
        order.assigned_agent_id === null)
    ) {
      hasAccess = true;
    }

    if (!hasAccess) {
      throw new HttpException(
        'Unauthorized to access messages for this order',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private resolvePersona(
    user: { id: string; user_type_id?: string | null },
    order: MessagingOrder
  ): PersonaId {
    if (isActivePersona(user, 'client') && order.client?.user_id === user.id) {
      return 'client';
    }
    if (
      isActivePersona(user, 'business') &&
      order.business?.user_id === user.id
    ) {
      return 'business';
    }
    if (
      isActivePersona(user, 'agent') &&
      order.assigned_agent?.user_id === user.id
    ) {
      return 'agent';
    }
    const active = (user.user_type_id ?? '') as PersonaId;
    return (['client', 'business', 'agent'] as PersonaId[]).includes(active)
      ? active
      : 'client';
  }

  private async loadOrderForMessaging(orderId: string): Promise<MessagingOrder> {
    const query = `
      query GetOrderForMessaging($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          business_id
          client_id
          assigned_agent_id
          current_status
          client {
            user_id
            user {
              first_name
              last_name
              preferred_language
            }
          }
          business {
            user_id
            user {
              first_name
              last_name
              preferred_language
            }
          }
          assigned_agent {
            user_id
            user {
              first_name
              last_name
              preferred_language
            }
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: MessagingOrder | null;
    }>(query, { orderId });

    if (!result.orders_by_pk) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }

    return result.orders_by_pk;
  }

  private async insertMention(
    messageId: string,
    mentionedUserId: string,
    mentionedPersona: PersonaId
  ): Promise<void> {
    const mutation = `
      mutation InsertMessageMention(
        $message_id: uuid!
        $mentioned_user_id: uuid!
        $mentioned_persona: String!
      ) {
        insert_message_mentions_one(object: {
          message_id: $message_id
          mentioned_user_id: $mentioned_user_id
          mentioned_persona: $mentioned_persona
        }) {
          id
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      message_id: messageId,
      mentioned_user_id: mentionedUserId,
      mentioned_persona: mentionedPersona,
    });
  }

  /** Legacy broadcast: push to all participants except the sender (feature-flag off path). */
  private async broadcastLegacyPush(
    order: MessagingOrder,
    senderUserId: string,
    senderName: string,
    messageId: string
  ): Promise<void> {
    try {
      const recipientIds = Array.from(
        new Set(
          [
            order.client?.user_id,
            order.business?.user_id,
            order.assigned_agent?.user_id,
          ].filter((id): id is string => !!id && id !== senderUserId)
        )
      );

      await Promise.all(
        recipientIds.map((recipientUserId) =>
          this.notificationsService.sendNewOrderMessagePush({
            recipientUserId,
            orderId: order.id,
            orderNumber: order.order_number,
            senderName,
            messageId,
          })
        )
      );
    } catch (error: any) {
      this.logger.warn(
        `broadcastLegacyPush failed for order ${order.order_number}: ${
          error?.message ?? String(error)
        }`
      );
    }
  }

  private async insertRecipients(
    messageId: string,
    recipients: Array<{ userId: string; type: string }>
  ): Promise<void> {
    if (recipients.length === 0) return;

    const objects = recipients.map((r) => ({
      message_id: messageId,
      recipient_user_id: r.userId,
      recipient_type: r.type,
    }));

    const mutation = `
      mutation InsertMessageRecipients($objects: [message_recipients_insert_input!]!) {
        insert_message_recipients(objects: $objects) {
          affected_rows
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, { objects });
  }
}
