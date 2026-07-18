import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeliveryPinService } from '../../delivery-pin/delivery-pin.service';
import type { Configuration } from '../../config/configuration';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import type { PersonaId } from '../../users/persona.types';
import { isActivePersona } from '../../users/persona.util';
import { MessagingService } from '../messaging.service';
import type { MessageCreatedEvent, OrderMessage } from '../messaging.types';
import { DeliveryPinMessageHandler } from './handlers/delivery-pin.handler';
import type { DeliveryPinPayloadV1 } from './structured-message.types';
import { StructuredMessageTypeRegistry } from './structured-message.registry';

const SHARE_RATE_LIMIT_MS = 10 * 60 * 1000;
const MAX_SHARES_PER_WINDOW = 3;

@Injectable()
export class DeliveryPinShareService {
  private readonly logger = new Logger(DeliveryPinShareService.name);
  private readonly recentShareTimestamps = new Map<string, number[]>();

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly messagingService: MessagingService,
    private readonly deliveryPinService: DeliveryPinService,
    private readonly deliveryPinHandler: DeliveryPinMessageHandler,
    private readonly registry: StructuredMessageTypeRegistry,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService<Configuration>
  ) {}

  isEnabled(): boolean {
    if (process.env.DELIVERY_PIN_MESSAGING_ENABLED === 'false') return false;
    return (
      process.env.DELIVERY_PIN_MESSAGING_ENABLED === 'true' ||
      process.env.STRUCTURED_MESSAGES_ENABLED === 'true' ||
      process.env.NODE_ENV !== 'production'
    );
  }

  async shareDeliveryPin(orderId: string): Promise<OrderMessage> {
    if (!this.isEnabled()) {
      throw new HttpException(
        'Delivery PIN messaging is not enabled',
        HttpStatus.NOT_FOUND
      );
    }

    const user = await this.hasuraUserService.getUser();
    this.requireClient(user);

    const order = await this.messagingService.loadOrderForMessagingPublic(orderId);
    await this.messagingService.assertMessagingAccess(user, order);

    if (order.client?.user_id !== user.id) {
      throw new HttpException(
        'Only the order client can share the delivery PIN',
        HttpStatus.FORBIDDEN
      );
    }

    if (order.current_status === 'complete' || order.current_status === 'cancelled') {
      throw new HttpException(
        'Delivery PIN cannot be shared for this order status',
        HttpStatus.BAD_REQUEST
      );
    }

    const isPickup = order.fulfillment_method === 'pickup';
    if (isPickup && order.current_status !== 'ready_for_pickup') {
      throw new HttpException(
        'Pickup PIN can only be shared when the order is ready for pickup',
        HttpStatus.BAD_REQUEST
      );
    }

    const sharedToUserId = isPickup
      ? order.business?.user_id
      : order.assigned_agent?.user_id;
    if (!sharedToUserId) {
      throw new HttpException(
        isPickup
          ? 'Business user is required before sharing the pickup PIN'
          : 'An assigned delivery agent is required before sharing the delivery PIN',
        HttpStatus.BAD_REQUEST
      );
    }

    this.assertRateLimit(orderId);

    const pin = isPickup
      ? await this.ensurePinAvailable(orderId)
      : await this.deliveryPinService.getPinForClient(orderId);
    if (!pin) {
      throw new HttpException(
        'Delivery PIN is not available for this order',
        HttpStatus.NOT_FOUND
      );
    }

    const pinVersion = await this.getNextPinVersion(orderId);
    await this.supersedeActivePinMessages(orderId);

    const payload = this.deliveryPinHandler.buildPayload(
      pin,
      sharedToUserId,
      pinVersion
    );

    const senderPersona: PersonaId = 'client';
    const displayMessage = this.registry.buildDisplayMessage('DELIVERY_PIN', {
      orderId,
      senderUserId: user.id,
      senderPersona,
      order,
    });

    const created = await this.insertStructuredMessage(
      user.id,
      order.id,
      displayMessage,
      payload
    );

    const mentionPersona: PersonaId = isPickup ? 'business' : 'agent';
    await this.insertMention(created.id, sharedToUserId, mentionPersona);

    const recipients = this.deliveryPinHandler.resolveRecipients(order, payload);
    await this.insertRecipients(created.id, recipients);

    await this.insertShareEvent({
      orderId,
      messageId: created.id,
      sharedByUserId: user.id,
      sharedToUserId,
      pinVersion,
      eventType: 'shared',
    });

    const senderName =
      `${created.user?.first_name ?? ''} ${created.user?.last_name ?? ''}`.trim();

    this.dispatchNotification(
      order,
      created.id,
      senderName,
      sharedToUserId,
      recipients
    );

    return this.messagingService.enrichSingleMessage(
      {
        ...created,
        message_type: 'DELIVERY_PIN',
        message_payload: payload,
        is_immutable: true,
      },
      order,
      user.id,
      senderPersona
    );
  }

  /** Generate + persist a PIN when store-pickup orders lack a retrievable one. */
  private async ensurePinAvailable(orderId: string): Promise<string | null> {
    const existing = await this.deliveryPinService.getPinForClient(orderId);
    if (existing) return existing;

    const pin = this.deliveryPinService.generatePin();
    const hash = this.deliveryPinService.hashPin(orderId, pin);
    await this.hasuraSystemService.executeMutation(
      `mutation SetDeliveryPinHash($orderId: uuid!, $hash: String!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId },
          _set: { delivery_pin_hash: $hash }
        ) { id }
      }`,
      { orderId, hash }
    );
    await this.deliveryPinService.setPinForClient(orderId, pin);
    return pin;
  }

  async getActiveDeliveryPinForCurrentUser(orderId: string): Promise<{
    messageId: string;
    pin: string;
    pinVersion: number;
    sharedAt: string;
  } | null> {
    const user = await this.hasuraUserService.getUser();
    if (isActivePersona(user, 'agent') && user.agent) {
      return this.getActiveDeliveryPinForAgent(orderId);
    }
    if (isActivePersona(user, 'business') && user.business) {
      return this.getActiveDeliveryPinForBusiness(orderId);
    }
    throw new HttpException(
      'Only the assigned agent or business can read the shared PIN',
      HttpStatus.FORBIDDEN
    );
  }

  async getActiveDeliveryPinForAgent(orderId: string): Promise<{
    messageId: string;
    pin: string;
    pinVersion: number;
    sharedAt: string;
  } | null> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'agent') || !user.agent) {
      throw new HttpException('Agent only', HttpStatus.FORBIDDEN);
    }

    const order = await this.messagingService.loadOrderForMessagingPublic(orderId);
    if (order.assigned_agent_id !== user.agent.id) {
      throw new HttpException('Not assigned to this order', HttpStatus.FORBIDDEN);
    }
    if (order.current_status !== 'out_for_delivery') {
      return null;
    }

    return this.readActiveSharedPin(orderId, user.id);
  }

  /** Latest active pickup PIN shared to the order's business in chat. */
  async getActiveDeliveryPinForBusiness(orderId: string): Promise<{
    messageId: string;
    pin: string;
    pinVersion: number;
    sharedAt: string;
  } | null> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'business') || !user.business) {
      throw new HttpException('Business only', HttpStatus.FORBIDDEN);
    }

    const order = await this.messagingService.loadOrderForMessagingPublic(orderId);
    if (order.business_id !== user.business.id) {
      throw new HttpException('Not the business for this order', HttpStatus.FORBIDDEN);
    }
    if (order.fulfillment_method !== 'pickup') {
      return null;
    }
    if (order.current_status !== 'ready_for_pickup') {
      return null;
    }

    return this.readActiveSharedPin(orderId, user.id);
  }

  private async readActiveSharedPin(
    orderId: string,
    sharedToUserId: string
  ): Promise<{
    messageId: string;
    pin: string;
    pinVersion: number;
    sharedAt: string;
  } | null> {
    const message = await this.findLatestActivePinMessage(orderId);
    if (!message) return null;

    const payload = message.message_payload as unknown as DeliveryPinPayloadV1;
    if (payload.sharedToUserId !== sharedToUserId || payload.status !== 'active') {
      return null;
    }

    const pin = this.deliveryPinService.decryptPinFromMessage(payload.pinCiphertext);
    if (!pin) return null;

    const hash = await this.getOrderPinHash(orderId);
    if (hash && !this.deliveryPinService.verifyPin(orderId, pin, hash)) {
      await this.markMessageSuperseded(message.id, 'pin_regenerated');
      return null;
    }

    return {
      messageId: message.id,
      pin,
      pinVersion: payload.pinVersion,
      sharedAt: message.created_at,
    };
  }

  async resolvePinForCompletion(
    orderId: string,
    recipientUserId: string,
    options: { pinMessageId?: string; useLatestSharedPin?: boolean }
  ): Promise<{ pin: string; messageId: string } | null> {
    if (!options.useLatestSharedPin && !options.pinMessageId) {
      return null;
    }

    let message: {
      id: string;
      created_at: string;
      message_payload: DeliveryPinPayloadV1;
    } | null = null;

    if (options.pinMessageId) {
      message = await this.getPinMessageById(orderId, options.pinMessageId);
    } else {
      message = await this.findLatestActivePinMessage(orderId);
    }

    if (!message) return null;

    const payload = message.message_payload;
    if (
      payload.status !== 'active' ||
      payload.sharedToUserId !== recipientUserId
    ) {
      return null;
    }

    const pin = this.deliveryPinService.decryptPinFromMessage(payload.pinCiphertext);
    if (!pin) return null;

    const hash = await this.getOrderPinHash(orderId);
    if (hash && !this.deliveryPinService.verifyPin(orderId, pin, hash)) {
      await this.markMessageSuperseded(message.id, 'pin_regenerated');
      return null;
    }

    return { pin, messageId: message.id };
  }

  async markPinConsumed(orderId: string, messageId: string): Promise<void> {
    const message = await this.getPinMessageById(orderId, messageId);
    if (!message) return;

    const payload = message.message_payload;
    await this.revokePinMessage(messageId, 'order_completed');

    const query = `
      query MessageSender($id: uuid!) {
        user_messages_by_pk(id: $id) { user_id }
      }
    `;
    const senderResult = await this.hasuraSystemService.executeQuery<{
      user_messages_by_pk: { user_id: string } | null;
    }>(query, { id: messageId });
    const sharedBy = senderResult.user_messages_by_pk?.user_id ?? payload.sharedToUserId;

    await this.insertShareEvent({
      orderId,
      messageId,
      sharedByUserId: sharedBy,
      sharedToUserId: payload.sharedToUserId,
      pinVersion: payload.pinVersion,
      eventType: 'consumed',
    });
  }

  async revokeActivePinMessagesForOrder(
    orderId: string,
    reason: DeliveryPinPayloadV1['revokedReason']
  ): Promise<void> {
    const messages = await this.findActivePinMessages(orderId);
    await Promise.all(
      messages.map((m) => this.revokePinMessage(m.id, reason))
    );
  }

  private requireClient(user: {
    client?: { id?: string } | null;
    user_type_id?: string | null;
  }): void {
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Client only', HttpStatus.FORBIDDEN);
    }
  }

  private assertRateLimit(orderId: string): void {
    const now = Date.now();
    const timestamps = (this.recentShareTimestamps.get(orderId) ?? []).filter(
      (t) => now - t < SHARE_RATE_LIMIT_MS
    );
    if (timestamps.length >= MAX_SHARES_PER_WINDOW) {
      throw new HttpException(
        'Too many PIN share attempts. Please wait before trying again.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    timestamps.push(now);
    this.recentShareTimestamps.set(orderId, timestamps);
  }

  private async getNextPinVersion(orderId: string): Promise<number> {
    const query = `
      query MaxPinVersion($orderId: uuid!) {
        delivery_pin_share_events_aggregate(
          where: { order_id: { _eq: $orderId }, event_type: { _eq: "shared" } }
        ) {
          aggregate { max { pin_version } }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      delivery_pin_share_events_aggregate: {
        aggregate: { max: { pin_version: number | null } | null };
      };
    }>(query, { orderId });
    const max =
      result.delivery_pin_share_events_aggregate?.aggregate?.max?.pin_version ?? 0;
    return max + 1;
  }

  private async supersedeActivePinMessages(orderId: string): Promise<void> {
    const active = await this.findActivePinMessages(orderId);
    for (const msg of active) {
      await this.markMessageSuperseded(msg.id, 'manual_resend');
    }
  }

  private async findActivePinMessages(orderId: string): Promise<
    Array<{ id: string; message_payload: DeliveryPinPayloadV1 }>
  > {
    const query = `
      query ActivePinMessages($orderId: uuid!) {
        user_messages(
          where: {
            entity_id: { _eq: $orderId }
            entity_type: { _eq: order }
            message_type: { _eq: "DELIVERY_PIN" }
          }
          order_by: { created_at: desc }
        ) {
          id
          message_payload
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{
        id: string;
        message_payload: DeliveryPinPayloadV1;
      }>;
    }>(query, { orderId });

    return (result.user_messages ?? []).filter(
      (m) => m.message_payload?.status === 'active'
    );
  }

  private async findLatestActivePinMessage(orderId: string): Promise<{
    id: string;
    created_at: string;
    message_payload: DeliveryPinPayloadV1;
  } | null> {
    const query = `
      query LatestActivePin($orderId: uuid!) {
        user_messages(
          where: {
            entity_id: { _eq: $orderId }
            entity_type: { _eq: order }
            message_type: { _eq: "DELIVERY_PIN" }
          }
          order_by: { created_at: desc }
          limit: 5
        ) {
          id
          created_at
          message_payload
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{
        id: string;
        created_at: string;
        message_payload: DeliveryPinPayloadV1;
      }>;
    }>(query, { orderId });

    return (
      (result.user_messages ?? []).find(
        (m) => m.message_payload?.status === 'active'
      ) ?? null
    );
  }

  private async getPinMessageById(
    orderId: string,
    messageId: string
  ): Promise<{
    id: string;
    created_at: string;
    message_payload: DeliveryPinPayloadV1;
  } | null> {
    const query = `
      query PinMessageById($orderId: uuid!, $messageId: uuid!) {
        user_messages(
          where: {
            id: { _eq: $messageId }
            entity_id: { _eq: $orderId }
            entity_type: { _eq: order }
            message_type: { _eq: "DELIVERY_PIN" }
          }
          limit: 1
        ) {
          id
          created_at
          message_payload
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{
        id: string;
        created_at: string;
        message_payload: DeliveryPinPayloadV1;
      }>;
    }>(query, { orderId, messageId });
    return result.user_messages?.[0] ?? null;
  }

  private async getOrderPinHash(orderId: string): Promise<string | null> {
    const query = `
      query OrderPinHash($orderId: uuid!) {
        orders_by_pk(id: $orderId) { delivery_pin_hash }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: { delivery_pin_hash: string | null } | null;
    }>(query, { orderId });
    return result.orders_by_pk?.delivery_pin_hash ?? null;
  }

  private async insertStructuredMessage(
    userId: string,
    orderId: string,
    message: string,
    payload: DeliveryPinPayloadV1
  ): Promise<{
    id: string;
    user_id: string;
    entity_type: string;
    entity_id: string;
    message: string;
    created_at: string;
    updated_at: string;
    user?: { id: string; email: string; first_name: string; last_name: string };
  }> {
    const mutation = `
      mutation InsertDeliveryPinMessage(
        $user_id: uuid!
        $entity_id: uuid!
        $message: String!
        $message_payload: jsonb!
      ) {
        insert_user_messages_one(object: {
          user_id: $user_id
          entity_type: order
          entity_id: $entity_id
          message: $message
          message_type: DELIVERY_PIN
          message_payload: $message_payload
          is_immutable: true
        }) {
          id
          user_id
          entity_type
          entity_id
          message
          created_at
          updated_at
          user { id email first_name last_name }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation<{
      insert_user_messages_one: {
        id: string;
        user_id: string;
        entity_type: string;
        entity_id: string;
        message: string;
        created_at: string;
        updated_at: string;
        user?: { id: string; email: string; first_name: string; last_name: string };
      } | null;
    }>(mutation, {
      user_id: userId,
      entity_id: orderId,
      message,
      message_payload: payload,
    });

    const created = result.insert_user_messages_one;
    if (!created) {
      throw new HttpException('Failed to create PIN message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return created;
  }

  private async insertMention(
    messageId: string,
    mentionedUserId: string,
    persona: PersonaId
  ): Promise<void> {
    const mutation = `
      mutation InsertMention($message_id: uuid!, $mentioned_user_id: uuid!, $mentioned_persona: String!) {
        insert_message_mentions_one(object: {
          message_id: $message_id
          mentioned_user_id: $mentioned_user_id
          mentioned_persona: $mentioned_persona
        }) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      message_id: messageId,
      mentioned_user_id: mentionedUserId,
      mentioned_persona: persona,
    });
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
    await this.hasuraSystemService.executeMutation(
      `mutation InsertRecipients($objects: [message_recipients_insert_input!]!) {
        insert_message_recipients(objects: $objects) { affected_rows }
      }`,
      { objects }
    );
  }

  private async insertShareEvent(params: {
    orderId: string;
    messageId: string;
    sharedByUserId: string;
    sharedToUserId: string;
    pinVersion: number;
    eventType: string;
  }): Promise<void> {
    if (params.eventType === 'consumed') {
      const mutation = `
        mutation InsertConsumedEvent(
          $orderId: uuid!
          $messageId: uuid!
          $sharedBy: uuid!
          $sharedTo: uuid!
          $pinVersion: Int!
        ) {
          insert_delivery_pin_share_events_one(object: {
            order_id: $orderId
            message_id: $messageId
            shared_by_user_id: $sharedBy
            shared_to_user_id: $sharedTo
            pin_version: $pinVersion
            event_type: "consumed"
          }) { id }
        }
      `;
      try {
        await this.hasuraSystemService.executeMutation(mutation, {
          orderId: params.orderId,
          messageId: params.messageId,
          sharedBy: params.sharedByUserId,
          sharedTo: params.sharedToUserId,
          pinVersion: params.pinVersion,
        });
      } catch (error: any) {
        this.logger.warn(`Share event insert failed: ${error?.message}`);
      }
      return;
    }

    const mutation = `
      mutation InsertShareEvent(
        $orderId: uuid!
        $messageId: uuid!
        $sharedBy: uuid!
        $sharedTo: uuid!
        $pinVersion: Int!
        $eventType: String!
      ) {
        insert_delivery_pin_share_events_one(object: {
          order_id: $orderId
          message_id: $messageId
          shared_by_user_id: $sharedBy
          shared_to_user_id: $sharedTo
          pin_version: $pinVersion
          event_type: $eventType
        }) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId: params.orderId,
      messageId: params.messageId,
      sharedBy: params.sharedByUserId,
      sharedTo: params.sharedToUserId,
      pinVersion: params.pinVersion,
      eventType: params.eventType,
    });
  }

  private async markMessageSuperseded(
    messageId: string,
    reason: DeliveryPinPayloadV1['revokedReason']
  ): Promise<void> {
    const query = `
      query GetPinPayload($id: uuid!) {
        user_messages_by_pk(id: $id) { message_payload }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      user_messages_by_pk: { message_payload: DeliveryPinPayloadV1 } | null;
    }>(query, { id: messageId });

    const payload = result.user_messages_by_pk?.message_payload;
    if (!payload || payload.status !== 'active') return;

    const updated: DeliveryPinPayloadV1 = {
      ...payload,
      status: 'superseded',
      revokedAt: new Date().toISOString(),
      revokedReason: reason,
    };

    await this.hasuraSystemService.executeMutation(
      `mutation UpdatePayload($id: uuid!, $payload: jsonb!) {
        update_user_messages_by_pk(pk_columns: { id: $id }, _set: { message_payload: $payload }) { id }
      }`,
      { id: messageId, payload: updated }
    );
  }

  private async revokePinMessage(
    messageId: string,
    reason: DeliveryPinPayloadV1['revokedReason']
  ): Promise<void> {
    const query = `
      query GetPinPayload($id: uuid!) {
        user_messages_by_pk(id: $id) { message_payload }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      user_messages_by_pk: { message_payload: DeliveryPinPayloadV1 } | null;
    }>(query, { id: messageId });

    const payload = result.user_messages_by_pk?.message_payload;
    if (!payload || payload.status === 'revoked') return;

    const updated: DeliveryPinPayloadV1 = {
      ...payload,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedReason: reason,
    };

    await this.hasuraSystemService.executeMutation(
      `mutation UpdatePayload($id: uuid!, $payload: jsonb!) {
        update_user_messages_by_pk(pk_columns: { id: $id }, _set: { message_payload: $payload }) { id }
      }`,
      { id: messageId, payload: updated }
    );
  }

  private dispatchNotification(
    order: import('../messaging.types').MessagingOrder,
    messageId: string,
    senderName: string,
    mentionedUserId: string,
    recipients: Array<{ userId: string; type: 'mentioned' | 'default_route' }>
  ): void {
    const targetedRouting =
      this.configService.get<Configuration['messaging']>('messaging')
        ?.targetedRoutingEnabled ?? false;

    const event: MessageCreatedEvent = {
      messageId,
      orderId: order.id,
      orderNumber: order.order_number,
      senderUserId: order.client?.user_id ?? '',
      senderPersona: 'client',
      senderName,
      mentionedUserId,
      recipients,
      messageType: 'DELIVERY_PIN',
      fulfillmentMethod: order.fulfillment_method,
    };

    if (targetedRouting) {
      this.eventEmitter.emit('message.created', event);
    } else {
      this.logger.warn(
        `DELIVERY_PIN share for order ${order.order_number}: targeted routing disabled`
      );
    }
  }
}
