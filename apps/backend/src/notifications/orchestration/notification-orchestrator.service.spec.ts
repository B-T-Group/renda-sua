jest.mock('../notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('./notification-preference.service', () => ({
  NotificationPreferenceService: class NotificationPreferenceService {},
}));
jest.mock('./notification-analytics.service', () => ({
  NotificationAnalyticsService: class NotificationAnalyticsService {},
}));
jest.mock('./channels/email.channel', () => ({
  EmailChannel: class EmailChannel {},
}));
jest.mock('./channels/push.channel', () => ({
  PushChannel: class PushChannel {},
}));
jest.mock('./channels/sms.channel', () => ({
  SmsChannel: class SmsChannel {},
}));
jest.mock('./channels/whatsapp.channel', () => ({
  WhatsAppChannel: class WhatsAppChannel {},
}));

import { NotificationOrchestrator } from './notification-orchestrator.service';
import { NotificationPolicyService } from './notification-policy.service';
import type {
  NotifyRequest,
  UserNotificationPreferences,
} from './notification.types';

const basePrefs = (): UserNotificationPreferences => ({
  userId: 'recipient-1',
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
  phoneNumber: '+15559876543',
  phoneNumberVerified: true,
});

function actionableRequest(
  overrides: Partial<NotifyRequest> = {}
): NotifyRequest {
  return {
    type: 'order.created',
    category: 'actionable',
    recipientUserId: 'recipient-1',
    allowSmsFallback: true,
    channels: {
      push: { title: 'New order', body: 'You have a new order' },
      email: { to: 'merchant@example.com', subject: 'New order' },
      sms: { to: '+15551112222', body: 'New order' },
      whatsapp: {
        templateKey: 'order_created_business',
        variables: { order_number: '1001' },
        phoneE164: '+15551234567',
      },
    },
    ...overrides,
  };
}

describe('NotificationOrchestrator', () => {
  function createOrchestrator() {
    const prefs = {
      getPreferences: jest.fn().mockResolvedValue(basePrefs()),
      isWhatsAppEligible: jest.fn().mockReturnValue(true),
    };
    const analytics = {
      track: jest.fn().mockResolvedValue(undefined),
    };
    const pushChannel = {
      send: jest.fn().mockResolvedValue({
        channel: 'push',
        status: 'sent',
        providerMessageId: 'push-1',
      }),
    };
    const whatsAppChannel = {
      isConfigured: jest.fn().mockReturnValue(true),
      featureEnabled: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue({
        channel: 'whatsapp',
        status: 'sent',
        providerMessageId: 'wa-1',
      }),
    };
    const emailChannel = {
      send: jest.fn().mockResolvedValue({
        channel: 'email',
        status: 'sent',
        providerMessageId: 'email-1',
      }),
    };
    const smsChannel = {
      send: jest.fn().mockResolvedValue({
        channel: 'sms',
        status: 'sent',
        providerMessageId: 'sms-1',
      }),
    };
    const orchestrator = new NotificationOrchestrator(
      prefs as any,
      new NotificationPolicyService(),
      analytics as any,
      pushChannel as any,
      whatsAppChannel as any,
      emailChannel as any,
      smsChannel as any
    );
    return {
      orchestrator,
      prefs,
      analytics,
      pushChannel,
      whatsAppChannel,
      emailChannel,
      smsChannel,
    };
  }

  it('skips all channels when actor is the recipient', async () => {
    const { orchestrator, prefs, analytics, pushChannel, whatsAppChannel } =
      createOrchestrator();

    const result = await orchestrator.notify(
      actionableRequest({ actorUserId: 'recipient-1' })
    );

    expect(result.attempts).toEqual([]);
    expect(prefs.getPreferences).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
    expect(pushChannel.send).not.toHaveBeenCalled();
    expect(whatsAppChannel.send).not.toHaveBeenCalled();
  });

  it('does not fall back to email/SMS when WhatsApp is sent', async () => {
    const {
      orchestrator,
      analytics,
      pushChannel,
      whatsAppChannel,
      emailChannel,
      smsChannel,
    } = createOrchestrator();

    const result = await orchestrator.notify(actionableRequest());

    expect(pushChannel.send).toHaveBeenCalled();
    expect(whatsAppChannel.send).toHaveBeenCalled();
    expect(emailChannel.send).not.toHaveBeenCalled();
    expect(smsChannel.send).not.toHaveBeenCalled();
    expect(orchestrator.whatsAppSucceeded(result)).toBe(true);
    expect(analytics.track.mock.calls[0][0]).toMatchObject({
      status: 'requested',
      channel: 'push',
    });
    expect(
      analytics.track.mock.calls.some(
        ([payload]) =>
          payload.channel === 'whatsapp' && payload.status === 'sent'
      )
    ).toBe(true);
  });

  it('falls back to email when WhatsApp fails, then skips SMS', async () => {
    const { orchestrator, whatsAppChannel, emailChannel, smsChannel } =
      createOrchestrator();
    whatsAppChannel.send.mockResolvedValue({
      channel: 'whatsapp',
      status: 'failed',
      error: 'graph_error',
    });

    const result = await orchestrator.notify(actionableRequest());

    expect(emailChannel.send).toHaveBeenCalled();
    expect(smsChannel.send).not.toHaveBeenCalled();
    expect(orchestrator.whatsAppSucceeded(result)).toBe(false);
    expect(result.attempts.map((a) => a.channel)).toEqual([
      'push',
      'whatsapp',
      'email',
    ]);
  });

  it('falls back to SMS when WhatsApp and email both fail to send', async () => {
    const { orchestrator, whatsAppChannel, emailChannel, smsChannel } =
      createOrchestrator();
    whatsAppChannel.send.mockResolvedValue({
      channel: 'whatsapp',
      status: 'skipped',
      skippedReason: 'whatsapp_disabled_or_not_configured',
    });
    emailChannel.send.mockResolvedValue({
      channel: 'email',
      status: 'failed',
      error: 'bounce',
    });

    const result = await orchestrator.notify(actionableRequest());

    expect(emailChannel.send).toHaveBeenCalled();
    expect(smsChannel.send).toHaveBeenCalled();
    expect(result.attempts.map((a) => a.channel)).toEqual([
      'push',
      'whatsapp',
      'email',
      'sms',
    ]);
  });

  it('uses preference phone when WhatsApp payload phone is empty', async () => {
    const { orchestrator, whatsAppChannel } = createOrchestrator();

    await orchestrator.notify(
      actionableRequest({
        channels: {
          push: { title: 't', body: 'b' },
          whatsapp: {
            templateKey: 'order_created_business',
            variables: {},
            phoneE164: '',
          },
        },
      })
    );

    expect(whatsAppChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+15559876543' })
    );
  });

  it('returns missing_payload when primary channel is planned without payload', async () => {
    const {
      orchestrator,
      prefs,
      analytics,
      pushChannel,
      whatsAppChannel,
      emailChannel,
      smsChannel,
    } = createOrchestrator();
    const policy = {
      plan: jest.fn().mockReturnValue({
        primary: ['whatsapp'],
        emailIfNoWhatsApp: false,
        smsIfNoEmailOrWhatsApp: false,
      }),
    };
    const forced = new NotificationOrchestrator(
      prefs as any,
      policy as any,
      analytics as any,
      pushChannel as any,
      whatsAppChannel as any,
      emailChannel as any,
      smsChannel as any
    );

    const result = await forced.notify(
      actionableRequest({
        channels: {
          push: { title: 't', body: 'b' },
        },
      })
    );

    expect(result.attempts).toEqual([
      {
        channel: 'whatsapp',
        status: 'skipped',
        skippedReason: 'missing_payload',
      },
    ]);
    expect(whatsAppChannel.send).not.toHaveBeenCalled();
  });

  it('notifyMany runs requests sequentially and preserves order', async () => {
    const { orchestrator } = createOrchestrator();
    const results = await orchestrator.notifyMany([
      actionableRequest({ recipientUserId: 'a', actorUserId: 'a' }),
      actionableRequest({ recipientUserId: 'b' }),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].attempts).toEqual([]);
    expect(results[1].recipientUserId).toBe('b');
    expect(results[1].attempts.length).toBeGreaterThan(0);
  });
});
