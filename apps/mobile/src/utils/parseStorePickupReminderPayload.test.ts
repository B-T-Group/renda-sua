import { describe, expect, it } from 'vitest';
import {
  parseStorePickupReminderFromNotification,
  parseStorePickupReminderPayload,
} from './parseStorePickupReminderPayload';

describe('parseStorePickupReminderPayload', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';

  it('parses store_pickup_reminder event', () => {
    expect(
      parseStorePickupReminderPayload({
        event: 'store_pickup_reminder',
        orderId,
        orderNumber: 'P-100',
      })
    ).toEqual({ orderId, orderNumber: 'P-100' });
  });

  it('rejects other events', () => {
    expect(
      parseStorePickupReminderPayload({
        event: 'pickup_reminder',
        orderId,
      })
    ).toBeNull();
  });

  it('requires title and body from notification content', () => {
    expect(
      parseStorePickupReminderFromNotification({
        title: 'Your order is waiting',
        body: 'Please collect soon',
        data: { event: 'store_pickup_reminder', orderId },
      })
    ).toEqual({
      orderId,
      orderNumber: undefined,
      title: 'Your order is waiting',
      body: 'Please collect soon',
    });

    expect(
      parseStorePickupReminderFromNotification({
        title: 'Your order is waiting',
        data: { event: 'store_pickup_reminder', orderId },
      })
    ).toBeNull();
  });
});
