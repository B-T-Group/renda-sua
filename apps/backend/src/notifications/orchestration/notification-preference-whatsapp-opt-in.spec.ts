import { BadRequestException } from '@nestjs/common';
import { NotificationPreferenceService } from './notification-preference.service';

describe('NotificationPreferenceService WhatsApp opt-in', () => {
  let hasura: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
  };
  let service: NotificationPreferenceService;

  const prefsRow = {
    user_id: 'user-1',
    push_enabled: true,
    email_enabled: true,
    sms_enabled: true,
    whatsapp_enabled: false,
    whatsapp_opted_in_at: null,
    whatsapp_informational_enabled: false,
    marketing_enabled: false,
    order_updates: true,
    chat: true,
    marketplace: true,
    reminders: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    service = new NotificationPreferenceService(hasura as never);
  });

  function mockPrefsAndPhone(phone: {
    phone_number?: string | null;
    phone_number_verified?: boolean | null;
  }) {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('user_notification_preferences_by_pk')) {
        return { user_notification_preferences_by_pk: prefsRow };
      }
      if (query.includes('users_by_pk')) {
        return {
          users_by_pk: {
            id: 'user-1',
            phone_number: phone.phone_number ?? null,
            phone_number_verified: phone.phone_number_verified ?? null,
          },
        };
      }
      return {};
    });
  }

  it('rejects WhatsApp enable when phone is missing', async () => {
    mockPrefsAndPhone({ phone_number: null, phone_number_verified: false });

    await expect(
      service.patchPreferences('user-1', { whatsappEnabled: true })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('allows WhatsApp enable when a phone number is present', async () => {
    mockPrefsAndPhone({
      phone_number: '+237600000001',
      phone_number_verified: false,
    });

    await service.patchPreferences('user-1', { whatsappEnabled: true });

    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('update_user_notification_preferences_by_pk'),
      expect.objectContaining({
        userId: 'user-1',
        set: expect.objectContaining({
          whatsapp_enabled: true,
        }),
      })
    );
  });

  it('enables WhatsApp and stamps opted_in_at when phone is verified', async () => {
    mockPrefsAndPhone({
      phone_number: '+237600000001',
      phone_number_verified: true,
    });

    const result = await service.patchPreferences('user-1', {
      whatsappEnabled: true,
    });

    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('update_user_notification_preferences_by_pk'),
      expect.objectContaining({
        userId: 'user-1',
        set: expect.objectContaining({
          whatsapp_enabled: true,
          whatsapp_opted_in_at: expect.any(String),
        }),
      })
    );
    expect(result.phoneNumberVerified).toBe(true);
    expect(result.phoneNumber).toBe('+237600000001');
  });

  it('isWhatsAppEligible requires enabled + a phone number', () => {
    expect(
      service.isWhatsAppEligible({
        userId: 'user-1',
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: true,
        whatsappEnabled: true,
        whatsappOptedInAt: '2026-08-01T00:00:00Z',
        whatsappInformationalEnabled: false,
        marketingEnabled: false,
        orderUpdates: true,
        chat: true,
        marketplace: true,
        reminders: true,
        phoneNumber: '+237600000001',
        phoneNumberVerified: true,
      })
    ).toBe(true);

    expect(
      service.isWhatsAppEligible({
        userId: 'user-1',
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: true,
        whatsappEnabled: true,
        whatsappOptedInAt: null,
        whatsappInformationalEnabled: false,
        marketingEnabled: false,
        orderUpdates: true,
        chat: true,
        marketplace: true,
        reminders: true,
        phoneNumber: '+237600000001',
        phoneNumberVerified: false,
      })
    ).toBe(true);
  });

  it('findUserIdByPhoneE164 matches with and without leading plus', async () => {
    hasura.executeQuery.mockResolvedValue({
      users: [{ id: 'user-9' }],
    });

    await expect(service.findUserIdByPhoneE164('+237600000001')).resolves.toBe(
      'user-9'
    );
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('phone_number'),
      { a: '237600000001', b: '+237600000001' }
    );
  });
});
