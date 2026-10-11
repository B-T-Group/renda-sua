import { Injectable, Logger } from '@nestjs/common';
import { NotificationActionTokenService } from '../notifications/orchestration/notification-action-token.service';
import { NotificationAnalyticsService } from '../notifications/orchestration/notification-analytics.service';
import { NotificationOrchestrator } from '../notifications/orchestration/notification-orchestrator.service';
import type { NotifyRequest } from '../notifications/orchestration/notification.types';
import { STOP_ACTION_TITLE } from './restock-alerts.messages';
import type {
  NotifierOutcome,
  RestockAnalytics,
  RestockChannel,
  RestockMessage,
  RestockNotifier,
} from './restock-alerts.types';

export const RESTOCK_STOP_ACTION_PREFIX = 'restock_stop:';
const STOP_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Sends ONE channel through the notification orchestrator (single channel, AC-2.9). */
@Injectable()
export class OrchestratorRestockNotifier implements RestockNotifier {
  private readonly logger = new Logger(OrchestratorRestockNotifier.name);

  constructor(
    private readonly orchestrator: NotificationOrchestrator,
    private readonly tokens: NotificationActionTokenService
  ) {}

  async send(params: {
    userId: string;
    channel: RestockChannel;
    locale: 'en' | 'fr';
    message: RestockMessage;
    idempotencyKey: string;
    entityId: string;
    phone: string | null;
  }): Promise<NotifierOutcome> {
    const { channel, message, locale } = params;
    const base: Omit<NotifyRequest, 'channels' | 'category'> = {
      type: message.kind === 'digest' ? 'restock.digest' : 'restock.alert',
      recipientUserId: params.userId,
      locale,
      dedupeKey: params.idempotencyKey,
      entityType: message.kind === 'digest' ? 'likes' : 'item',
      entityId: params.entityId,
      preferenceCategory: 'marketplace',
      payload: { src: 'restock_alert', kind: message.kind },
    };
    let request: NotifyRequest;
    if (channel === 'push') {
      const stopToken = await this.tokens.issue({
        userId: params.userId,
        action: `${RESTOCK_STOP_ACTION_PREFIX}push`,
        entityId: params.userId,
        ttlSeconds: STOP_TOKEN_TTL_SECONDS,
      });
      request = {
        ...base,
        category: 'informational',
        channels: {
          push: {
            title: message.push.title,
            body: message.push.body,
            data: {
              type: base.type,
              src: 'restock_alert',
              url: message.url,
              path: message.path,
              deepLink: message.appLink,
              stopToken,
              actions: [{ id: 'stop_restock_alerts', title: STOP_ACTION_TITLE[locale] }],
            },
          },
        },
      };
    } else if (channel === 'whatsapp') {
      request = {
        ...base,
        category: 'informational',
        channels: {
          whatsapp: {
            templateKey: 'restock_alert',
            variables: message.whatsapp,
            ctaUrl: message.url,
          },
        },
      };
    } else {
      if (!params.phone) return 'skipped';
      request = {
        ...base,
        category: 'actionable',
        allowSmsFallback: true,
        channels: { sms: { to: params.phone, body: message.sms } },
      };
    }
    const result = await this.orchestrator.notify(request);
    const attempt = result.attempts.find((a) => a.channel === channel);
    if (!attempt) return 'skipped';
    if (attempt.status === 'sent' || attempt.status === 'delivered') return 'sent';
    if (attempt.status === 'skipped') return 'skipped';
    this.logger.warn(`restock ${channel} send failed: ${attempt.error ?? 'unknown'}`);
    return 'failed';
  }
}

/** Analytics §8 through the existing notification_events table. No PII in meta. */
@Injectable()
export class NotificationRestockAnalytics implements RestockAnalytics {
  constructor(private readonly events: NotificationAnalyticsService) {}

  async track(
    event: string,
    userId: string | null,
    meta: Record<string, string | number | boolean>
  ): Promise<void> {
    const channel = (typeof meta.channel === 'string' ? meta.channel : 'push') as
      | 'push'
      | 'whatsapp'
      | 'sms';
    await this.events.track({
      notificationType: event,
      category: 'informational',
      userId,
      channel,
      status: event === 'restock.alert_sent' ? 'sent' : 'skipped',
      entityType: 'restock',
      meta,
    });
  }
}
