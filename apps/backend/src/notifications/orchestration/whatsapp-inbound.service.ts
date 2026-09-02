import { createHmac, timingSafeEqual } from 'crypto';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../config/configuration';
import { NotificationAnalyticsService } from './notification-analytics.service';
import {
  WhatsAppInboxPersistenceService,
  type WhatsAppDeliveryStatus,
  type WhatsAppMessageType,
} from './whatsapp-inbox-persistence.service';
import { WhatsAppReplyService } from './whatsapp-reply.service';

interface WhatsAppStatusEvent {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: Array<{ message?: string }>;
  [key: string]: unknown;
}

interface WhatsAppInboundMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  [key: string]: unknown;
}

interface WhatsAppChangeValue {
  statuses?: WhatsAppStatusEvent[];
  messages?: WhatsAppInboundMessage[];
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  [key: string]: unknown;
}

@Injectable()
export class WhatsAppInboundService {
  private readonly logger = new Logger(WhatsAppInboundService.name);

  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly analytics: NotificationAnalyticsService,
    private readonly replyService: WhatsAppReplyService,
    private readonly inbox: WhatsAppInboxPersistenceService
  ) {}

  assertValidSignature(
    rawBody: Buffer | string | undefined,
    signatureHeader: string | undefined
  ): void {
    const appSecret =
      this.configService.get<Configuration['whatsapp']>('whatsapp')?.appSecret;
    if (!appSecret?.trim()) {
      throw new ForbiddenException(
        'WhatsApp webhook rejected: WHATSAPP_APP_SECRET is not configured'
      );
    }
    if (!signatureHeader?.startsWith('sha256=')) {
      throw new ForbiddenException('Missing WhatsApp signature');
    }
    const expected = createHmac('sha256', appSecret)
      .update(rawBody || '')
      .digest('hex');
    const provided = signatureHeader.slice('sha256='.length);
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid WhatsApp signature');
    }
  }

  async handleWebhookBody(body: unknown): Promise<{ received: true }> {
    const entries = (body as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries) {
      const changes =
        (entry as { changes?: Array<{ value?: WhatsAppChangeValue }> })
          ?.changes ?? [];
      for (const change of changes) {
        await this.processValue(change.value);
      }
    }
    return { received: true };
  }

  private async processValue(value?: WhatsAppChangeValue): Promise<void> {
    if (!value) return;
    for (const status of value.statuses ?? []) {
      await this.handleStatus(status, value);
    }
    for (const message of value.messages ?? []) {
      await this.handleMessage(message, value);
    }
  }

  private async handleStatus(
    status: WhatsAppStatusEvent,
    event: WhatsAppChangeValue
  ): Promise<void> {
    if (!status.id || !status.status) return;
    const mapped = this.mapDeliveryStatus(status.status);
    await this.analytics.markByProviderMessageId(
      status.id,
      mapped === 'failed' ? 'failed' : mapped === 'sent' ? 'sent' : 'delivered',
      event as Record<string, unknown>
    );
    await this.inbox.markByWamid(
      status.id,
      mapped,
      status.errors?.[0]?.message
    );
  }

  private mapDeliveryStatus(status: string): WhatsAppDeliveryStatus {
    if (status === 'delivered') return 'delivered';
    if (status === 'failed') return 'failed';
    if (status === 'sent') return 'sent';
    if (status === 'read') return 'read';
    return 'sent';
  }

  private async handleMessage(
    message: WhatsAppInboundMessage,
    value: WhatsAppChangeValue
  ): Promise<void> {
    const from = message.from?.trim();
    if (!from) return;
    const type = this.mapMessageType(message.type);
    const body = this.extractBody(message, type);
    try {
      await this.inbox.persistInbound({
        waId: from,
        customerPhone: from,
        wamid: message.id,
        type,
        body,
        rawPayload: message as Record<string, unknown>,
        bumpUnread: true,
      });
    } catch (error: any) {
      this.logger.warn(
        `Inbox persist failed for ${from}: ${error?.message ?? String(error)}`
      );
    }
    if (type === 'interactive') {
      await this.routeInteractive(from, message);
      return;
    }
    const text = message.text?.body;
    if (!text) return;
    await this.replyService.handleInboundText({
      fromPhone: from,
      text,
      messageId: message.id,
    });
    void value;
  }

  private async routeInteractive(
    from: string,
    message: WhatsAppInboundMessage
  ): Promise<void> {
    const interactive = message.interactive as
      | {
          button_reply?: { id?: string; title?: string };
          list_reply?: { id?: string; title?: string };
        }
      | undefined;
    const reply = interactive?.button_reply || interactive?.list_reply;
    await this.replyService.handleInteractiveReply({
      fromPhone: from,
      buttonId: reply?.id,
      buttonTitle: reply?.title,
      messageId: message.id,
    });
  }

  private mapMessageType(type?: string): WhatsAppMessageType {
    const allowed: WhatsAppMessageType[] = [
      'text',
      'image',
      'audio',
      'video',
      'document',
      'location',
      'interactive',
    ];
    if (type && allowed.includes(type as WhatsAppMessageType)) {
      return type as WhatsAppMessageType;
    }
    return type === 'template' ? 'template' : 'unknown';
  }

  private extractBody(
    message: WhatsAppInboundMessage,
    type: WhatsAppMessageType
  ): string {
    if (type === 'text') return message.text?.body?.trim() || '';
    if (type === 'location') return '[Location]';
    if (type === 'interactive') {
      const interactive = message.interactive as
        | { button_reply?: { title?: string; id?: string } }
        | undefined;
      const title = interactive?.button_reply?.title?.trim();
      const id = interactive?.button_reply?.id?.trim();
      if (title && id) return `${title} (${id})`;
      return title || id || '[Interactive reply]';
    }
    if (type === 'image') return '[Image]';
    if (type === 'audio') return '[Audio]';
    if (type === 'video') return '[Video]';
    if (type === 'document') return '[Document]';
    return `[${type}]`;
  }
}
