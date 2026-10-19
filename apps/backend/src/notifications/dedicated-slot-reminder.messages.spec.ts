import { buildDedicatedSlotReminderMessage } from './dedicated-order-push.messages';

describe('#594 PR 6 (AC-A8) dedicated slot reminder copy', () => {
  const msg = (orderCount: number, preferredLanguage?: string | null) =>
    buildDedicatedSlotReminderMessage({ orderCount, storeName: 'Chez Mama', pickupTime: '17:30', slotKey: 'evening', preferredLanguage });

  it('"{{n}} scheduled orders at {{store}} · pickup {{time}}" in EN, singular and plural', () => {
    expect(msg(3, 'en')).toEqual({ title: 'Dedicated slot soon (Evening)', body: '3 scheduled orders at Chez Mama · pickup 17:30' });
    expect(msg(1, 'en-GB').body).toBe('1 scheduled order at Chez Mama · pickup 17:30');
  });

  it('FR, and French when the language is unknown (same rule as other notices)', () => {
    expect(msg(2, 'fr')).toEqual({
      title: 'Créneau dédié bientôt (Soir)',
      body: '2 commandes programmées chez Chez Mama · collecte à 17:30',
    });
    expect(msg(1, null).body).toBe('1 commande programmée chez Chez Mama · collecte à 17:30');
  });
});
