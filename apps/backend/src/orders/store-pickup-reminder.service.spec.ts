jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { StorePickupReminderService } from './store-pickup-reminder.service';

describe('StorePickupReminderService', () => {
  let service: StorePickupReminderService;
  let hasura: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
  };
  let notifications: { sendStorePickupReminderPush: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    notifications = {
      sendStorePickupReminderPush: jest.fn().mockResolvedValue(undefined),
    };
    config = {
      get: jest.fn().mockReturnValue({
        storePickupReminderEnabled: true,
        storePickupReminderHours: 24,
        storePickupCancelDays: 7,
        cleanupBatchLimit: 100,
      }),
    };
    service = new StorePickupReminderService(
      hasura as any,
      notifications as any,
      config as any
    );
  });

  it('sends when ready ≥24h and last_sent is null', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      orders: [
        {
          id: 'o1',
          order_number: 'P1',
          updated_at: '2026-08-01T10:00:00.000Z',
          pickup_reminder_last_sent_at: null,
          client: {
            user_id: 'client-1',
            user: { preferred_language: 'en' },
          },
          order_status_history: [
            {
              status: 'ready_for_pickup',
              created_at: '2026-08-01T10:00:00.000Z',
            },
          ],
        },
      ],
    });

    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T11:00:00.000Z'));
    const result = await service.runHourlyReminders();
    jest.useRealTimers();

    expect(result).toEqual({ sent: 1 });
    expect(notifications.sendStorePickupReminderPush).toHaveBeenCalledWith({
      clientUserId: 'client-1',
      orderId: 'o1',
      orderNumber: 'P1',
      preferredLanguage: 'en',
    });
    expect(hasura.executeMutation).toHaveBeenCalled();
  });

  it('skips when last_sent within 24h', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      orders: [
        {
          id: 'o1',
          order_number: 'P1',
          updated_at: '2026-08-01T10:00:00.000Z',
          pickup_reminder_last_sent_at: '2026-08-02T10:00:00.000Z',
          client: {
            user_id: 'client-1',
            user: { preferred_language: 'en' },
          },
          order_status_history: [
            {
              status: 'ready_for_pickup',
              created_at: '2026-08-01T10:00:00.000Z',
            },
          ],
        },
      ],
    });

    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T12:00:00.000Z'));
    const result = await service.runHourlyReminders();
    jest.useRealTimers();

    expect(result).toEqual({ sent: 0 });
    expect(notifications.sendStorePickupReminderPush).not.toHaveBeenCalled();
  });

  it('skips when ready age is past the 7-day cancel window', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      orders: [
        {
          id: 'o1',
          order_number: 'P1',
          updated_at: '2026-07-20T10:00:00.000Z',
          pickup_reminder_last_sent_at: null,
          client: {
            user_id: 'client-1',
            user: { preferred_language: 'en' },
          },
          order_status_history: [
            {
              status: 'ready_for_pickup',
              created_at: '2026-07-20T10:00:00.000Z',
            },
          ],
        },
      ],
    });

    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T11:00:00.000Z'));
    const result = await service.runHourlyReminders();
    jest.useRealTimers();

    expect(result).toEqual({ sent: 0 });
    expect(notifications.sendStorePickupReminderPush).not.toHaveBeenCalled();
  });

  it('skips when feature flag disabled', async () => {
    config.get.mockReturnValue({ storePickupReminderEnabled: false });
    const result = await service.runHourlyReminders();
    expect(result).toEqual({ sent: 0, skipped: true });
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });
});
