import { Injectable } from '@nestjs/common';
import type {
  NotificationChannel,
  NotifyRequest,
  UserNotificationPreferences,
} from './notification.types';

export interface ChannelPlan {
  /** Channels to attempt in parallel first (typically push + whatsapp). */
  primary: NotificationChannel[];
  /** Attempted only if WhatsApp was not successful. */
  emailIfNoWhatsApp: boolean;
  /** Attempted only if email and WhatsApp both failed/skipped. */
  smsIfNoEmailOrWhatsApp: boolean;
}

@Injectable()
export class NotificationPolicyService {
  plan(
    request: NotifyRequest,
    prefs: UserNotificationPreferences,
    capabilities: {
      hasPush: boolean;
      whatsappEligible: boolean;
      whatsappConfigured: boolean;
      hasEmail: boolean;
      hasSms: boolean;
      whatsappNotificationsEnabled: boolean;
    }
  ): ChannelPlan {
    if (!this.categoryAllowed(request, prefs)) {
      return {
        primary: [],
        emailIfNoWhatsApp: false,
        smsIfNoEmailOrWhatsApp: false,
      };
    }

    if (request.category === 'informational') {
      return this.informationalPlan(request, prefs, capabilities);
    }
    return this.actionablePlan(request, prefs, capabilities);
  }

  private actionablePlan(
    request: NotifyRequest,
    prefs: UserNotificationPreferences,
    capabilities: Parameters<NotificationPolicyService['plan']>[2]
  ): ChannelPlan {
    const primary: NotificationChannel[] = [];
    if (prefs.pushEnabled && capabilities.hasPush && request.channels.push) {
      primary.push('push');
    }
    if (
      capabilities.whatsappNotificationsEnabled &&
      capabilities.whatsappConfigured &&
      capabilities.whatsappEligible &&
      prefs.whatsappEnabled &&
      request.channels.whatsapp
    ) {
      primary.push('whatsapp');
    }
    return {
      primary,
      emailIfNoWhatsApp: !!(
        prefs.emailEnabled &&
        capabilities.hasEmail &&
        request.channels.email
      ),
      smsIfNoEmailOrWhatsApp: !!(
        request.allowSmsFallback &&
        prefs.smsEnabled &&
        capabilities.hasSms &&
        request.channels.sms
      ),
    };
  }

  private informationalPlan(
    request: NotifyRequest,
    prefs: UserNotificationPreferences,
    capabilities: Parameters<NotificationPolicyService['plan']>[2]
  ): ChannelPlan {
    const primary: NotificationChannel[] = [];
    if (prefs.pushEnabled && capabilities.hasPush && request.channels.push) {
      primary.push('push');
    }
    const emailIfNoWhatsApp = !!(
      prefs.emailEnabled &&
      capabilities.hasEmail &&
      request.channels.email
    );
    if (
      capabilities.whatsappNotificationsEnabled &&
      capabilities.whatsappConfigured &&
      capabilities.whatsappEligible &&
      prefs.whatsappInformationalEnabled &&
      request.channels.whatsapp
    ) {
      primary.push('whatsapp');
    }
    return {
      primary,
      emailIfNoWhatsApp,
      smsIfNoEmailOrWhatsApp: false,
    };
  }

  private categoryAllowed(
    request: NotifyRequest,
    prefs: UserNotificationPreferences
  ): boolean {
    const cat = request.preferenceCategory ?? this.defaultPreferenceCategory(request);
    if (cat === 'order_updates') return prefs.orderUpdates;
    if (cat === 'chat') return prefs.chat;
    if (cat === 'marketplace') return prefs.marketplace;
    if (cat === 'reminders') return prefs.reminders;
    if (cat === 'marketing') return prefs.marketingEnabled;
    return true;
  }

  private defaultPreferenceCategory(
    request: NotifyRequest
  ): NotifyRequest['preferenceCategory'] {
    if (request.type.startsWith('chat.')) return 'chat';
    if (request.type.startsWith('merchant.') || request.type === 'admin.broadcast') {
      return 'marketing';
    }
    if (
      request.type.includes('reminder') ||
      request.type.includes('ending_soon') ||
      request.type.includes('rating')
    ) {
      return 'reminders';
    }
    if (request.category === 'informational') return 'marketplace';
    return 'order_updates';
  }
}
