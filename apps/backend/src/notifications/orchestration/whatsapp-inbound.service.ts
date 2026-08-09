import { createHmac, timingSafeEqual } from 'crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../config/configuration';
import { NotificationAnalyticsService } from './notification-analytics.service';
import { WhatsAppReplyService } from './whatsapp-reply.service';

interface WhatsAppChangeValue {
  statuses?: Array<{
    id?: string;
    status?: string;
    recipient_id?: string;
  }>;
  messages?: Array<{
    from?: string;
    id?: string;
    type?: string;
    text?: { body?: string };
  }>;
}

@Injectable()
export class WhatsAppInboundService {
  constructor(
    private readonly configService: ConfigService<Configuration>,
    private readonly analytics: NotificationAnalyticsService,
    private readonly replyService: WhatsAppReplyService
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
      await this.handleStatus(status);
    }
    for (const message of value.messages ?? []) {
      await this.handleMessage(message);
    }
  }

  private async handleStatus(status: {
    id?: string;
    status?: string;
  }): Promise<void> {
    if (!status.id || !status.status) return;
    const mapped =
      status.status === 'delivered'
        ? 'delivered'
        : status.status === 'failed'
          ? 'failed'
          : status.status === 'sent'
            ? 'sent'
            : status.status === 'read'
              ? 'delivered'
              : 'attempted';
    await this.analytics.markByProviderMessageId(status.id, mapped as any, {
      waStatus: status.status,
    });
  }

  private async handleMessage(message: {
    from?: string;
    id?: string;
    type?: string;
    text?: { body?: string };
  }): Promise<void> {
    const text = message.text?.body;
    if (!message.from || !text) return;
    await this.replyService.handleInboundText({
      fromPhone: message.from,
      text,
      messageId: message.id,
    });
  }
}
