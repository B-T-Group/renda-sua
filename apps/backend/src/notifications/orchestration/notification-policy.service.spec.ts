import { NotificationPolicyService } from './notification-policy.service';
import type {
  NotifyRequest,
  UserNotificationPreferences,
} from './notification.types';

const basePrefs = (): UserNotificationPreferences => ({
  userId: 'u1',
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: true,
  whatsappEnabled: true,
  whatsappOptedInAt: new Date().toISOString(),
  whatsappInformationalEnabled: false,
  marketingEnabled: false,
  orderUpdates: true,
  chat: true,
  marketplace: true,
  reminders: true,
  phoneNumber: '+15551234567',
  phoneNumberVerified: true,
});

describe('NotificationPolicyService', () => {
  const policy = new NotificationPolicyService();

  it('plans actionable: push + whatsapp primary, email if no WA, sms last', () => {
    const request: NotifyRequest = {
      type: 'order.created',
      category: 'actionable',
      recipientUserId: 'u1',
      allowSmsFallback: true,
      channels: {
        push: { title: 't', body: 'b' },
        email: { to: 'a@b.com' },
        sms: { to: '+1555', body: 'hi' },
        whatsapp: { templateKey: 'order_created_business', variables: {} },
      },
    };
    const plan = policy.plan(request, basePrefs(), {
      hasPush: true,
      whatsappEligible: true,
      whatsappConfigured: true,
      hasEmail: true,
      hasSms: true,
      whatsappNotificationsEnabled: true,
    });
    expect(plan.primary).toEqual(['push', 'whatsapp']);
    expect(plan.emailIfNoWhatsApp).toBe(true);
    expect(plan.smsIfNoEmailOrWhatsApp).toBe(true);
  });

  it('omits whatsapp when not opted in', () => {
    const prefs = { ...basePrefs(), whatsappEnabled: false };
    const request: NotifyRequest = {
      type: 'order.created',
      category: 'actionable',
      recipientUserId: 'u1',
      channels: {
        push: { title: 't', body: 'b' },
        whatsapp: { templateKey: 'order_created_business', variables: {} },
      },
    };
    const plan = policy.plan(request, prefs, {
      hasPush: true,
      whatsappEligible: false,
      whatsappConfigured: true,
      hasEmail: false,
      hasSms: false,
      whatsappNotificationsEnabled: true,
    });
    expect(plan.primary).toEqual(['push']);
  });

  it('informational includes WA only with informational opt-in', () => {
    const prefs = {
      ...basePrefs(),
      whatsappInformationalEnabled: true,
    };
    const request: NotifyRequest = {
      type: 'merchant.digest',
      category: 'informational',
      recipientUserId: 'u1',
      preferenceCategory: 'marketing',
      channels: {
        push: { title: 't', body: 'b' },
        email: { to: 'a@b.com' },
        whatsapp: { templateKey: 'order_status_client', variables: {} },
      },
    };
    prefs.marketingEnabled = true;
    const plan = policy.plan(request, prefs, {
      hasPush: true,
      whatsappEligible: true,
      whatsappConfigured: true,
      hasEmail: true,
      hasSms: false,
      whatsappNotificationsEnabled: true,
    });
    expect(plan.primary).toContain('whatsapp');
    expect(plan.smsIfNoEmailOrWhatsApp).toBe(false);
  });
});
