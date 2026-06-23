import { NotificationsService } from './notifications.service';
import { buildNewOrderMessagePushMessage } from './wallet-credit-push.messages';

describe('buildNewOrderMessagePushMessage', () => {
  it('builds English copy and falls back when the sender name is blank', () => {
    expect(
      buildNewOrderMessagePushMessage({
        orderNumber: 'ORD-42',
        senderName: '   ',
        preferredLanguage: 'en',
      })
    ).toEqual({
      title: 'New message · Order ORD-42',
      body: 'Someone sent you a message',
    });
  });

  it('builds French copy with the trimmed sender name', () => {
    expect(
      buildNewOrderMessagePushMessage({
        orderNumber: 'ORD-42',
        senderName: ' Camille Dupont ',
        preferredLanguage: 'fr',
      })
    ).toEqual({
      title: 'Nouveau message · Commande ORD-42',
      body: 'Camille Dupont vous a envoyé un message',
    });
  });
});

describe('NotificationsService.sendNewOrderMessagePush', () => {
  let service: NotificationsService;
  let configService: { get: jest.Mock };
  let hasuraSystemService: { executeQuery: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) =>
        key === 'push' ? { enabled: true } : undefined
      ),
    };
    hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        users_by_pk: {
          email: 'recipient@example.com',
          preferred_language: 'fr',
        },
      }),
    };
    service = new NotificationsService(
      configService as any,
      hasuraSystemService as any,
      { sendSms: jest.fn() } as any
    );
    jest
      .spyOn(service as any, 'sendPushNotificationByUserId')
      .mockResolvedValue({ webSent: 1, expoSent: 0 });
  });

  it('sends a localized order-message push payload to the recipient user id', async () => {
    await service.sendNewOrderMessagePush({
      recipientUserId: ' recipient-1 ',
      orderId: 'order-42',
      orderNumber: 'ORD-42',
      senderName: 'Camille Dupont',
    });

    expect((service as any).sendPushNotificationByUserId).toHaveBeenCalledWith(
      'recipient-1',
      'Nouveau message · Commande ORD-42',
      'Camille Dupont vous a envoyé un message',
      {
        url: '/orders/order-42',
        orderId: 'order-42',
        orderNumber: 'ORD-42',
        event: 'order_message',
      }
    );
  });

  it('does not query or send when push notifications are disabled', async () => {
    configService.get.mockReturnValue({ enabled: false });

    await service.sendNewOrderMessagePush({
      recipientUserId: 'recipient-1',
      orderId: 'order-42',
      orderNumber: 'ORD-42',
      senderName: 'Camille Dupont',
    });

    expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
    expect((service as any).sendPushNotificationByUserId).not.toHaveBeenCalled();
  });
});
