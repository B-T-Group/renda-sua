import { NotificationsService } from './notifications.service';
import type { NotificationData } from './notification-types';

describe('NotificationsService.getClientAlertPushOptions', () => {
  const alertOptions = { priority: 'high', sound: 'default' };

  function buildService() {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'push' ? { enabled: true } : undefined
      ),
    };
    return new NotificationsService(
      configService as never,
      { executeQuery: jest.fn(), executeMutation: jest.fn() } as never,
      {} as never,
      {} as never
    );
  }

  function baseData(
    overrides: Partial<NotificationData> = {}
  ): NotificationData {
    return {
      orderId: 'order-1',
      orderNumber: '1001',
      clientName: 'Client',
      businessName: 'Biz',
      orderStatus: 'confirmed',
      orderItems: [],
      subtotal: 0,
      deliveryFee: 0,
      taxAmount: 0,
      totalAmount: 0,
      currency: 'CAD',
      deliveryAddress: '1 Main St',
      ...overrides,
    };
  }

  function optionsFor(
    service: NotificationsService,
    status: string,
    recipientType: string,
    data: NotificationData
  ) {
    return (service as any).getClientAlertPushOptions(
      status,
      recipientType,
      data
    );
  }

  it('alerts the client when the order is confirmed', () => {
    const service = buildService();
    expect(optionsFor(service, 'confirmed', 'client', baseData())).toEqual(
      alertOptions
    );
  });

  it('alerts the client when a store-pickup order is ready', () => {
    const service = buildService();
    const data = baseData({
      orderStatus: 'ready_for_pickup',
      fulfillmentMethod: 'pickup',
    });
    expect(
      optionsFor(service, 'ready_for_pickup', 'client', data)
    ).toEqual(alertOptions);
  });

  it('does not alert for ready_for_pickup on delivery orders', () => {
    const service = buildService();
    const data = baseData({
      orderStatus: 'ready_for_pickup',
      fulfillmentMethod: 'delivery',
    });
    expect(
      optionsFor(service, 'ready_for_pickup', 'client', data)
    ).toBeUndefined();
  });

  it('does not alert non-client recipients on confirmed', () => {
    const service = buildService();
    expect(
      optionsFor(service, 'confirmed', 'business', baseData())
    ).toBeUndefined();
    expect(
      optionsFor(service, 'confirmed', 'agent', baseData())
    ).toBeUndefined();
  });

  it('does not alert the client for non-milestone statuses', () => {
    const service = buildService();
    expect(
      optionsFor(service, 'preparing', 'client', baseData())
    ).toBeUndefined();
    expect(
      optionsFor(service, 'in_transit', 'client', baseData())
    ).toBeUndefined();
  });

  it('omits channelId so Android uses the Expo fallback channel', () => {
    const service = buildService();
    const opts = optionsFor(service, 'confirmed', 'client', baseData());
    expect(opts).toEqual(alertOptions);
    expect(opts).not.toHaveProperty('channelId');
  });

  it('passes alert options through sendPushForOrderStatus for client confirmed', async () => {
    const service = buildService();
    const sendPush = jest
      .spyOn(service as any, 'sendPushNotificationByUserId')
      .mockResolvedValue({ webSent: 1, expoSent: 0 });
    jest.spyOn(service as any, 'getRecipientsForStatus').mockReturnValue([
      { type: 'client', userId: 'user-client', email: 'c@example.com' },
    ]);

    await (service as any).sendPushForOrderStatus(baseData());

    expect(sendPush).toHaveBeenCalledWith(
      'user-client',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ orderId: 'order-1', persona: 'client' }),
      alertOptions
    );
  });

  it('keeps default silent delivery for business on confirmed', async () => {
    const service = buildService();
    const sendPush = jest
      .spyOn(service as any, 'sendPushNotificationByUserId')
      .mockResolvedValue({ webSent: 1, expoSent: 0 });
    jest.spyOn(service as any, 'getRecipientsForStatus').mockReturnValue([
      { type: 'business', userId: 'user-biz', email: 'b@example.com' },
    ]);

    await (service as any).sendPushForOrderStatus(baseData());

    expect(sendPush).toHaveBeenCalledWith(
      'user-biz',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ persona: 'business' }),
      undefined
    );
  });
});
