import { NotificationAnalyticsService } from './notification-analytics.service';

describe('NotificationAnalyticsService fail-soft', () => {
  function createService() {
    const hasura = { executeMutation: jest.fn() };
    const service = new NotificationAnalyticsService(hasura as any);
    return { service, hasura };
  }

  const event = {
    notificationType: 'order.cancelled',
    category: 'actionable' as const,
    userId: 'user-1',
    channel: 'email' as const,
    status: 'sent' as const,
    entityType: 'order',
    entityId: 'order-1',
  };

  it('inserts a notification event', async () => {
    const { service, hasura } = createService();
    hasura.executeMutation.mockResolvedValue({
      insert_notification_events_one: { id: 'evt-1' },
    });

    await expect(service.track(event)).resolves.toBeUndefined();
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('insert_notification_events_one'),
      expect.objectContaining({
        object: expect.objectContaining({
          notification_type: 'order.cancelled',
          user_id: 'user-1',
          channel: 'email',
          entity_id: 'order-1',
        }),
      })
    );
  });

  it('swallows Hasura errors so delivery is not failed by analytics', async () => {
    const { service, hasura } = createService();
    hasura.executeMutation.mockRejectedValue(new Error('insert failed'));

    await expect(service.track(event)).resolves.toBeUndefined();
  });

  it('swallows webhook status updates and skips blank provider ids', async () => {
    const { service, hasura } = createService();
    hasura.executeMutation.mockRejectedValue(new Error('update failed'));

    await expect(service.markByProviderMessageId('', 'delivered')).resolves.toBeUndefined();
    expect(hasura.executeMutation).not.toHaveBeenCalled();

    await expect(
      service.markByProviderMessageId('wa-1', 'delivered')
    ).resolves.toBeUndefined();
  });
});
