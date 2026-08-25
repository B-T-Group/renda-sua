import { NotificationsService } from './notifications.service';
import type { NotificationData } from './notification-types';

const INCOMING_ORDER_PUSH = {
  priority: 'high',
  sound: 'default',
  channelId: 'order_incoming',
};

describe('NotificationsService incoming-order interrupts', () => {
  function createService() {
    const orchestrator = {
      notify: jest.fn().mockResolvedValue({ attempts: [] }),
      whatsAppSucceeded: jest.fn().mockReturnValue(false),
    };
    const hasura = { executeQuery: jest.fn() };
    const deepLink = {
      order: jest.fn().mockReturnValue({
        path: '/orders/order-1',
        universal: 'https://app.example/orders/order-1',
      }),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'push') return { enabled: true };
        if (key === 'email') return {};
        return undefined;
      }),
    };
    const service = new NotificationsService(
      configService as never,
      hasura as never,
      {} as never,
      {} as never,
      orchestrator as never,
      deepLink as never
    );
    const push = jest
      .spyOn(service, 'sendPushNotificationByUserId')
      .mockResolvedValue({ success: true, webSent: 0, expoSent: 1 });
    return { service, orchestrator, hasura, push };
  }

  function orderData(
    overrides: Partial<NotificationData> = {}
  ): NotificationData {
    return {
      orderId: 'order-1',
      orderNumber: '1001',
      businessUserId: 'biz-user',
      clientUserId: 'client-1',
      clientName: 'Ada',
      businessLocationId: 'loc-1',
      ...overrides,
    } as NotificationData;
  }

  function stubOrderManagers(hasura: { executeQuery: jest.Mock }) {
    hasura.executeQuery.mockImplementation((query: string) => {
      if (query.includes('LocationDelegationsFlag')) {
        return Promise.resolve({
          application_configurations: [{ boolean_value: true }],
        });
      }
      if (query.includes('OrderManagerDelegates')) {
        return Promise.resolve({
          location_delegations: [
            {
              user_id: 'delegate-1',
              role: {
                role_permissions: [
                  { permission: { key: 'delegation.orders.manage' } },
                ],
              },
            },
            {
              user_id: 'biz-user',
              role: {
                role_permissions: [
                  { permission: { key: 'delegation.orders.manage' } },
                ],
              },
            },
          ],
        });
      }
      return Promise.resolve({});
    });
  }

  function businessNotifyCall(orchestrator: { notify: jest.Mock }) {
    return orchestrator.notify.mock.calls.find(
      ([payload]) => payload.dedupeKey === 'order.created:business:order-1'
    )?.[0];
  }

  it('marks ASAP merchant order pushes interruptible', async () => {
    const { service, orchestrator, hasura, push } = createService();
    stubOrderManagers(hasura);

    await service.sendOrderCreatedNotifications(orderData());

    expect(businessNotifyCall(orchestrator).channels.push.interruptible).toBe(
      true
    );
    expect(push).toHaveBeenCalledWith(
      'delegate-1',
      'New order 1001',
      'From Ada',
      expect.objectContaining({ event: 'order_created' }),
      INCOMING_ORDER_PUSH
    );
    expect(push).not.toHaveBeenCalledWith(
      'biz-user',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('keeps scheduled merchant and delegate pushes quiet', async () => {
    const { service, orchestrator, hasura, push } = createService();
    stubOrderManagers(hasura);

    await service.sendOrderCreatedNotifications(
      orderData({
        acceptanceMode: 'scheduled',
        acceptanceActivatesAt: '2026-08-26T15:00:00.000Z',
      })
    );

    expect(businessNotifyCall(orchestrator)).toBeUndefined();
    expect(push).toHaveBeenCalledWith(
      'biz-user',
      'Scheduled order',
      expect.stringContaining('Order 1001'),
      expect.objectContaining({ event: 'order_scheduled' })
    );
    expect(push).toHaveBeenCalledWith(
      'delegate-1',
      'New order 1001',
      'From Ada',
      expect.objectContaining({ event: 'order_scheduled' }),
      undefined
    );
    expect(
      push.mock.calls.some((call) => call[4] === INCOMING_ORDER_PUSH)
    ).toBe(false);
  });

  it('interrupts the merchant and managers when a scheduled SLA activates', async () => {
    const { service, hasura, push } = createService();
    stubOrderManagers(hasura);

    await service.sendOrderAcceptanceActivatePush({
      businessUserId: 'biz-user',
      orderId: 'order-1',
      orderNumber: '1001',
      clientName: 'Ada',
      acceptanceTimeoutSeconds: 180,
      businessLocationId: 'loc-1',
    });

    expect(push).toHaveBeenCalledWith(
      'biz-user',
      'New order',
      expect.stringContaining('1001'),
      expect.objectContaining({ event: 'order_acceptance_activate' }),
      INCOMING_ORDER_PUSH
    );
    expect(push).toHaveBeenCalledWith(
      'delegate-1',
      'New order',
      expect.stringContaining('1001'),
      expect.objectContaining({ event: 'order_acceptance_activate' }),
      INCOMING_ORDER_PUSH
    );
  });
});
