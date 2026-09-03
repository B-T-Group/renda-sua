import { Injectable } from '@nestjs/common';
import { EmailChannel } from './channels/email.channel';
import { PushChannel } from './channels/push.channel';
import { SmsChannel } from './channels/sms.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import { NotificationAnalyticsService } from './notification-analytics.service';
import { NotificationPolicyService } from './notification-policy.service';
import { NotificationPreferenceService } from './notification-preference.service';
import type {
  ChannelAttemptResult,
  NotifyRequest,
  NotifyResult,
} from './notification.types';

@Injectable()
export class NotificationOrchestrator {
  constructor(
    private readonly prefs: NotificationPreferenceService,
    private readonly policy: NotificationPolicyService,
    private readonly analytics: NotificationAnalyticsService,
    private readonly pushChannel: PushChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly emailChannel: EmailChannel,
    private readonly smsChannel: SmsChannel
  ) {}

  async notify(request: NotifyRequest): Promise<NotifyResult> {
    if (
      request.actorUserId &&
      request.actorUserId === request.recipientUserId
    ) {
      return { type: request.type, recipientUserId: request.recipientUserId, attempts: [] };
    }

    const preferences = await this.prefs.getPreferences(request.recipientUserId);
    const capabilities = await this.resolveCapabilities(request, preferences);
    const plan = this.policy.plan(request, preferences, capabilities);

    await this.analytics.track({
      notificationType: request.type,
      category: request.category,
      userId: request.recipientUserId,
      channel: 'push',
      status: 'requested',
      dedupeKey: request.dedupeKey,
      entityType: request.entityType,
      entityId: request.entityId,
    });

    const attempts: ChannelAttemptResult[] = [];
    let whatsAppOk = false;

    for (const channel of plan.primary) {
      const result = await this.sendPrimary(channel, request, preferences);
      attempts.push(result);
      await this.trackAttempt(request, result);
      if (channel === 'whatsapp' && result.status === 'sent') {
        whatsAppOk = true;
      }
    }

    if (plan.emailIfNoWhatsApp && !whatsAppOk && request.channels.email) {
      const emailResult = await this.emailChannel.send(request.channels.email);
      attempts.push(emailResult);
      await this.trackAttempt(request, emailResult);
    }

    const emailOk = attempts.some(
      (a) => a.channel === 'email' && a.status === 'sent'
    );
    if (
      plan.smsIfNoEmailOrWhatsApp &&
      !whatsAppOk &&
      !emailOk &&
      request.channels.sms
    ) {
      const smsResult = await this.smsChannel.send(request.channels.sms);
      attempts.push(smsResult);
      await this.trackAttempt(request, smsResult);
    }

    return {
      type: request.type,
      recipientUserId: request.recipientUserId,
      attempts,
    };
  }

  async notifyMany(requests: NotifyRequest[]): Promise<NotifyResult[]> {
    const results: NotifyResult[] = [];
    for (const request of requests) {
      results.push(await this.notify(request));
    }
    return results;
  }

  /** True when WhatsApp was accepted by Graph for this notify result. */
  whatsAppSucceeded(result: NotifyResult): boolean {
    return result.attempts.some(
      (a) => a.channel === 'whatsapp' && a.status === 'sent'
    );
  }

  private async sendPrimary(
    channel: 'push' | 'whatsapp' | 'email' | 'sms',
    request: NotifyRequest,
    preferences: Awaited<ReturnType<NotificationPreferenceService['getPreferences']>>
  ): Promise<ChannelAttemptResult> {
    if (channel === 'push' && request.channels.push) {
      return this.pushChannel.send(request.recipientUserId, request.channels.push);
    }
    if (channel === 'whatsapp' && request.channels.whatsapp) {
      const phone =
        request.channels.whatsapp.phoneE164 || preferences.phoneNumber || '';
      return this.whatsAppChannel.send({
        to: phone,
        locale: request.locale,
        payload: request.channels.whatsapp,
        entityId: request.entityId,
        entityType: request.entityType,
      });
    }
    return {
      channel,
      status: 'skipped',
      skippedReason: 'missing_payload',
    };
  }

  private async resolveCapabilities(
    request: NotifyRequest,
    preferences: Awaited<ReturnType<NotificationPreferenceService['getPreferences']>>
  ) {
    const hasPush = !!request.channels.push;
    return {
      hasPush,
      whatsappEligible: this.prefs.isWhatsAppEligible(preferences),
      whatsappConfigured: this.whatsAppChannel.isConfigured(),
      hasEmail: !!request.channels.email?.to,
      hasSms: !!request.channels.sms?.to,
      whatsappNotificationsEnabled: this.whatsAppChannel.featureEnabled(),
    };
  }

  private async trackAttempt(
    request: NotifyRequest,
    result: ChannelAttemptResult
  ): Promise<void> {
    await this.analytics.track({
      notificationType: request.type,
      category: request.category,
      userId: request.recipientUserId,
      channel: result.channel,
      status: result.status,
      providerMessageId: result.providerMessageId,
      dedupeKey: request.dedupeKey,
      entityType: request.entityType,
      entityId: request.entityId,
      errorCode: result.error || result.skippedReason,
      meta: request.payload,
    });
  }
}
