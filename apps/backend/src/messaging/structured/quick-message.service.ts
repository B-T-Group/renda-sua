import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Configuration } from '../../config/configuration';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import type { PersonaId } from '../../users/persona.types';
import { isActivePersona } from '../../users/persona.util';
import { MessagingService } from '../messaging.service';
import { OrderParticipantsService } from '../order-participants.service';
import type {
  MessageCreatedEvent,
  MessagingOrder,
  OrderMessage,
} from '../messaging.types';
import { QuickMessageHandler } from './handlers/quick-message.handler';
import {
  getQuickMessageTemplate,
  isTemplateEligibleForOrder,
  QUICK_MESSAGE_TEMPLATES,
  resolveTemplateTagPersonas,
  type QuickMessageTemplate,
} from './quick-message.catalog';
import type { AuthorizedBusinessActor } from '../../orders/authorized-business-actor';
import type { QuickMessagePayloadV1 } from './structured-message.types';

export interface QuickMessageTemplateDto {
  id: string;
  buttonLabelKey: string;
  buttonLabelEn: string;
  buttonLabelFr: string;
  bodyI18nKey: string;
  bodyDefaultEn: string;
  tagPersonas: PersonaId[];
}

type AuthenticatedUser = Awaited<ReturnType<HasuraUserService['getUser']>>;

@Injectable()
export class QuickMessageService {
  private readonly logger = new Logger(QuickMessageService.name);
  private readonly recentSends = new Map<string, number>();
  private readonly inflightSends = new Map<string, Promise<OrderMessage>>();

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly messagingService: MessagingService,
    private readonly orderParticipantsService: OrderParticipantsService,
    private readonly quickMessageHandler: QuickMessageHandler,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService<Configuration>
  ) {}

  async listEligibleTemplatesForActor(
    orderId: string,
    actor: AuthorizedBusinessActor
  ): Promise<QuickMessageTemplateDto[]> {
    return this.listEligibleTemplates(
      orderId,
      this.messagingService.actorAsBusinessUser(actor) as AuthenticatedUser
    );
  }

  async listEligibleTemplates(
    orderId: string,
    viewer?: AuthenticatedUser
  ): Promise<QuickMessageTemplateDto[]> {
    const user = viewer ?? (await this.hasuraUserService.getUser());
    const order = await this.messagingService.loadOrderForMessagingPublic(orderId);
    await this.messagingService.assertMessagingAccess(user, order);
    const senderPersona = this.resolveSenderPersona(user, order);

    return QUICK_MESSAGE_TEMPLATES.filter((template) =>
      isTemplateEligibleForOrder(template, order, senderPersona)
    )
      .filter((template) => this.resolveTaggedUsers(template, order).length > 0)
      .map((template) => ({
        id: template.id,
        buttonLabelKey: template.buttonLabelKey,
        buttonLabelEn: template.buttonLabelEn,
        buttonLabelFr: template.buttonLabelFr,
        bodyI18nKey: template.i18nKey,
        bodyDefaultEn: template.defaultMessageEn,
        tagPersonas: resolveTemplateTagPersonas(template, order),
      }));
  }

  async sendQuickMessageForActor(
    orderId: string,
    templateId: string,
    actor: AuthorizedBusinessActor
  ): Promise<OrderMessage> {
    return this.sendQuickMessage(
      orderId,
      templateId,
      this.messagingService.actorAsBusinessUser(actor) as AuthenticatedUser
    );
  }

  async sendQuickMessage(
    orderId: string,
    templateId: string,
    viewer?: AuthenticatedUser
  ): Promise<OrderMessage> {
    const user = viewer ?? (await this.hasuraUserService.getUser());
    const order = await this.messagingService.loadOrderForMessagingPublic(orderId);
    await this.messagingService.assertMessagingAccess(user, order);

    const key = `${orderId}:${templateId}:${user.id}`;
    const existing = this.inflightSends.get(key);
    if (existing) return existing;

    const promise = this.sendQuickMessageOnce(
      orderId,
      templateId,
      user,
      order
    ).finally(() => {
      if (this.inflightSends.get(key) === promise) {
        this.inflightSends.delete(key);
      }
    });
    this.inflightSends.set(key, promise);
    return promise;
  }

  private async sendQuickMessageOnce(
    orderId: string,
    templateId: string,
    user: AuthenticatedUser,
    order: MessagingOrder
  ): Promise<OrderMessage> {
    const senderPersona = this.resolveSenderPersona(user, order);

    const template = getQuickMessageTemplate(templateId);
    if (!template) {
      throw new HttpException('Unknown quick message template', HttpStatus.BAD_REQUEST);
    }

    if (!isTemplateEligibleForOrder(template, order, senderPersona)) {
      throw new HttpException(
        'Quick message is not available for this order status or persona',
        HttpStatus.BAD_REQUEST
      );
    }

    const tagged = this.resolveTaggedUsers(template, order).filter(
      (t) => t.userId !== user.id
    );
    if (tagged.length === 0) {
      throw new HttpException(
        'No recipients available for this quick message',
        HttpStatus.BAD_REQUEST
      );
    }

    this.assertNotRateLimited(orderId, template);

    const taggedUserIds = tagged.map((t) => t.userId);
    const taggedPersonas = tagged.map((t) => t.persona);
    const payload = this.quickMessageHandler.buildPayload(
      template.id,
      taggedUserIds,
      taggedPersonas
    );
    const displayMessage = this.quickMessageHandler.buildDisplayMessageForTemplate(
      template.id
    );
    const recipients = this.quickMessageHandler
      .resolveRecipients(order, payload)
      .filter((r) => r.userId !== user.id);

    const created = await this.insertStructuredMessageWithTags(
      user.id,
      order.id,
      displayMessage,
      payload,
      tagged,
      recipients
    );
    this.recordSuccessfulSend(orderId, template);

    const senderName =
      `${created.user?.first_name ?? ''} ${created.user?.last_name ?? ''}`.trim();

    this.dispatchNotification(
      order,
      created.id,
      user.id,
      senderPersona,
      senderName,
      template.id,
      recipients
    );

    return this.messagingService.enrichSingleMessage(
      {
        ...created,
        message_type: 'QUICK_MESSAGE',
        message_payload: payload,
        is_immutable: true,
        mentions: tagged.map((t) => ({
          mentioned_user_id: t.userId,
          mentioned_persona: t.persona,
        })),
      },
      order,
      user.id,
      senderPersona
    );
  }

  private resolveTaggedUsers(
    template: QuickMessageTemplate,
    order: MessagingOrder
  ): Array<{ userId: string; persona: PersonaId }> {
    const personas = resolveTemplateTagPersonas(template, order);
    const participants = this.orderParticipantsService.getParticipants(order);
    const result: Array<{ userId: string; persona: PersonaId }> = [];
    const seenUserIds = new Set<string>();

    for (const persona of personas) {
      const participant = participants.find((p) => p.persona === persona);
      if (!participant || seenUserIds.has(participant.userId)) continue;
      seenUserIds.add(participant.userId);
      result.push({ userId: participant.userId, persona });
    }
    return result;
  }

  private resolveSenderPersona(
    user: AuthenticatedUser,
    order: MessagingOrder
  ): PersonaId {
    if (isActivePersona(user, 'client') && order.client?.user_id === user.id) {
      return 'client';
    }
    if (
      isActivePersona(user, 'business') &&
      (order.business?.user_id === user.id ||
        (user.business?.id != null && user.business.id === order.business_id))
    ) {
      return 'business';
    }
    if (
      isActivePersona(user, 'agent') &&
      (order.assigned_agent?.user_id === user.id ||
        (user.agent?.id != null && user.agent.id === order.assigned_agent_id))
    ) {
      return 'agent';
    }
    const fromOrder = this.orderParticipantsService.resolvePersona(order, user.id);
    if (fromOrder) return fromOrder;
    throw new HttpException(
      'Unable to resolve sender persona for quick message',
      HttpStatus.FORBIDDEN
    );
  }

  private assertNotRateLimited(
    orderId: string,
    template: QuickMessageTemplate
  ): void {
    const key = `${orderId}:${template.id}`;
    const last = this.recentSends.get(key);
    if (last != null && Date.now() - last < template.rateLimitMs) {
      throw new HttpException(
        'Please wait before sending this quick message again',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private recordSuccessfulSend(
    orderId: string,
    template: QuickMessageTemplate
  ): void {
    this.recentSends.set(`${orderId}:${template.id}`, Date.now());
  }

  private async insertStructuredMessageWithTags(
    userId: string,
    orderId: string,
    message: string,
    payload: QuickMessagePayloadV1,
    tagged: Array<{ userId: string; persona: PersonaId }>,
    recipients: Array<{ userId: string; type: string }>
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
    const mentionsData = tagged.map((t) => ({
      mentioned_user_id: t.userId,
      mentioned_persona: t.persona,
    }));
    const recipientsData = recipients.map((r) => ({
      recipient_user_id: r.userId,
      recipient_type: r.type,
    }));

    const mutation = `
      mutation InsertQuickMessage(
        $user_id: uuid!
        $entity_id: uuid!
        $message: String!
        $message_payload: jsonb!
        $mentions: [message_mentions_insert_input!]!
        $recipients: [message_recipients_insert_input!]!
      ) {
        insert_user_messages_one(object: {
          user_id: $user_id
          entity_type: order
          entity_id: $entity_id
          message: $message
          message_type: QUICK_MESSAGE
          message_payload: $message_payload
          is_immutable: true
          mentions: { data: $mentions }
          recipients: { data: $recipients }
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
      mentions: mentionsData,
      recipients: recipientsData,
    });

    const created = result.insert_user_messages_one;
    if (!created) {
      throw new HttpException(
        'Failed to create quick message',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return created;
  }

  private dispatchNotification(
    order: MessagingOrder,
    messageId: string,
    senderUserId: string,
    senderPersona: PersonaId,
    senderName: string,
    templateId: string,
    recipients: Array<{ userId: string; type: 'mentioned' | 'default_route' }>
  ): void {
    const targetedRouting =
      this.configService.get<Configuration['messaging']>('messaging')
        ?.targetedRoutingEnabled ?? false;

    const event: MessageCreatedEvent = {
      messageId,
      orderId: order.id,
      orderNumber: order.order_number,
      senderUserId,
      senderPersona,
      senderName,
      mentionedUserId: recipients[0]?.userId,
      recipients,
      messageType: 'QUICK_MESSAGE',
      fulfillmentMethod: order.fulfillment_method,
      quickMessageTemplateId: templateId,
    };

    if (targetedRouting) {
      this.eventEmitter.emit('message.created', event);
    } else {
      this.logger.warn(
        `QUICK_MESSAGE for order ${order.order_number}: targeted routing disabled`
      );
    }
  }
}
