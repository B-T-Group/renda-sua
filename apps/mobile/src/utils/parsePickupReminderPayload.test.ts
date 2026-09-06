import {
  parsePickupReminderFromNotification,
  parsePickupReminderPayload,
} from './parsePickupReminderPayload';

describe('parsePickupReminderPayload', () => {
  it('parses pickup reminder push data', () => {
    expect(
      parsePickupReminderPayload({
        event: 'pickup_reminder',
        orderId: 'o1',
        orderNumber: '94732957',
      })
    ).toEqual({
      orderId: 'o1',
      orderNumber: '94732957',
      businessName: undefined,
      pickupDueAt: undefined,
    });
  });

  it('returns null for unrelated events', () => {
    expect(
      parsePickupReminderPayload({
        event: 'business_referral_review_rejected',
        orderId: 'o1',
      })
    ).toBeNull();
  });

  it('merges notification title and body', () => {
    const parsed = parsePickupReminderFromNotification({
      title: 'Pickup reminder',
      body: 'Order 94732957 should be collected by 12:16. Head to Virtual Sales now.',
      data: {
        event: 'pickup_reminder',
        orderId: 'o1',
        orderNumber: '94732957',
      },
    });
    expect(parsed).toEqual({
      orderId: 'o1',
      orderNumber: '94732957',
      businessName: undefined,
      pickupDueAt: undefined,
      title: 'Pickup reminder',
      body: 'Order 94732957 should be collected by 12:16. Head to Virtual Sales now.',
    });
  });
});
