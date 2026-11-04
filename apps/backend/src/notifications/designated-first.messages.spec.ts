import {
  buildDesignatedEarlyOfferMessage,
  buildDesignatedLateReleaseMessage,
  buildDesignatedOpenOfferReminderMessage,
  buildDesignatedPickupReminderMessage,
  buildDesignatedUnconfirmedMessage,
  designatedWindowLabel,
} from './designated-first.messages';

const offer = {
  date: '2026-11-10',
  window: '09:00–11:00',
  businessName: 'ACEGUARD',
  pickupKm: 2.4,
  area: 'Yaoundé, Centre',
  dropoffKm: 6.1,
  commission: 500,
  currency: 'XAF',
};

describe('designated-first messages (EN/FR)', () => {
  it('early offer shows date, window, business, area, distances and earnings', () => {
    const en = buildDesignatedEarlyOfferMessage({ ...offer, preferredLanguage: 'en' });
    expect(en.title).toContain('New order for you');
    expect(en.title).toContain('09:00–11:00');
    expect(en.body).toContain('ACEGUARD');
    expect(en.body).toContain('Yaoundé, Centre');
    expect(en.body).toContain('2.4');
    expect(en.body).toContain('Earn');
    const fr = buildDesignatedEarlyOfferMessage({ ...offer, preferredLanguage: 'fr' });
    expect(fr.title).toContain('Nouvelle commande pour vous');
    expect(fr.body).toContain('Retrait ACEGUARD');
    expect(fr.body).toContain('Gain');
  });

  it('defaults to French', () => {
    expect(buildDesignatedEarlyOfferMessage({ ...offer }).title).toContain('Nouvelle commande');
  });

  it('builds every notice in both languages', () => {
    for (const lang of ['en', 'fr']) {
      const msgs = [
        buildDesignatedOpenOfferReminderMessage({ businessName: 'B', gateTime: '08:30', preferredLanguage: lang }),
        buildDesignatedPickupReminderMessage({ kind: 'evening', orderNumber: 'O1', businessName: 'B', date: '2026-11-10', window: '09:00', preferredLanguage: lang }),
        buildDesignatedPickupReminderMessage({ kind: 'soon', orderNumber: 'O1', businessName: 'B', date: '2026-11-10', window: '09:00', preferredLanguage: lang }),
        buildDesignatedUnconfirmedMessage({ orderNumber: 'O1', preferredLanguage: lang }),
        buildDesignatedLateReleaseMessage({ orderNumber: 'O1', preferredLanguage: lang }),
      ];
      for (const m of msgs) {
        expect(m.title.length).toBeGreaterThan(0);
        expect(m.body.length).toBeGreaterThan(0);
      }
    }
    expect(buildDesignatedLateReleaseMessage({ orderNumber: 'O1', preferredLanguage: 'fr' }).body).toContain('O1');
  });

  it('formats the window', () => {
    expect(designatedWindowLabel('09:00:00', '11:00:00')).toContain('09:00');
  });
});
