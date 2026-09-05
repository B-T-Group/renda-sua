import {
  buildStorePickupReminderNotify,
  storePickupReminderDedupeKey,
} from './store-pickup-reminder-push';

describe('buildStorePickupReminderNotify', () => {
  const now = new Date('2026-09-04T10:15:00.000Z');

  it('returns null for blank client user ids', () => {
    expect(
      buildStorePickupReminderNotify({
        clientUserId: '   ',
        orderId: 'o1',
        orderNumber: 'P1',
        now,
      })
    ).toBeNull();
  });

  it('opens the reminder sheet and buckets dedupe by hour', () => {
    const actual = buildStorePickupReminderNotify({
      clientUserId: ' client-1 ',
      orderId: 'o1',
      orderNumber: 'P1',
      preferredLanguage: 'en',
      now,
    });
    expect(actual?.recipientUserId).toBe('client-1');
    expect(actual?.locale).toBe('en');
    expect(actual?.dedupeKey).toBe(
      storePickupReminderDedupeKey('o1', now)
    );
    expect(actual?.dedupeKey).toBe('order.store_pickup.reminder:o1:2026-09-04T10');
    expect(actual?.channels.push.data).toEqual({
      url: '/orders/o1?pickupReminder=1',
      orderId: 'o1',
      orderNumber: 'P1',
      event: 'store_pickup_reminder',
      persona: 'client',
    });
    expect(actual?.channels.push.title).toBe('Order ready for pickup');
  });

  it('uses French copy when language is missing (existing locale default)', () => {
    const actual = buildStorePickupReminderNotify({
      clientUserId: 'client-1',
      orderId: 'o1',
      orderNumber: 'P1',
      now,
    });
    expect(actual?.locale).toBe('fr');
    expect(actual?.channels.push.title).toBe('Commande à récupérer');
    expect(actual?.channels.push.body).toMatch(/P1/);
  });
});
