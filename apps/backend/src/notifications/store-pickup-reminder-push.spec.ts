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
    expect(actual?.channels.push.body).not.toMatch(/conserve/);
  });

  it('tells the client the kept percent on a merchant reminder and skips a fresh dedupe bucket', () => {
    const english = buildStorePickupReminderNotify({
      clientUserId: 'client-1',
      orderId: 'o1',
      orderNumber: 'P1',
      preferredLanguage: 'en',
      feePercent: 30,
      bustDedupe: true,
      now,
    });
    expect(english?.channels.push.body).toBe(
      'Your order P1 is ready. Please come collect it. Cancelling keeps 30% of the items.'
    );
    expect(english?.dedupeKey).toMatch(/^order\.store_pickup\.reminder:o1:\d+$/);
    expect(english?.dedupeKey).not.toBe(storePickupReminderDedupeKey('o1', now));

    const french = buildStorePickupReminderNotify({
      clientUserId: 'client-1',
      orderId: 'o1',
      orderNumber: 'P1',
      preferredLanguage: 'fr',
      feePercent: 12.5,
      bustDedupe: true,
      now,
    });
    expect(french?.channels.push.body).toContain('Annuler conserve 12.5 % des articles.');

    const free = buildStorePickupReminderNotify({
      clientUserId: 'client-1',
      orderId: 'o1',
      orderNumber: 'P1',
      preferredLanguage: 'en',
      feePercent: 0,
      bustDedupe: true,
      now,
    });
    expect(free?.channels.push.body).toBe('Your order P1 is ready. Please come collect it.');
  });

  it('keeps the hourly cron copy when a fee percent is present but dedupe is not busted', () => {
    const actual = buildStorePickupReminderNotify({
      clientUserId: 'client-1',
      orderId: 'o1',
      orderNumber: 'P1',
      preferredLanguage: 'en',
      feePercent: 30,
      now,
    });
    expect(actual?.channels.push.body).toBe(
      'Your order P1 is waiting. Tap to cancel, message the store, or close.'
    );
    expect(actual?.dedupeKey).toBe('order.store_pickup.reminder:o1:2026-09-04T10');
  });
});
