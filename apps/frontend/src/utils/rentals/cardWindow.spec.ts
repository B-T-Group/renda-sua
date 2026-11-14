import {
  cardDayBlocked,
  cardEndMisses,
  cardWindowErrorMessage,
  cardWindowNote,
  cardWindowSendReason,
  effectiveCardEnd,
  formatCardCutoff,
} from './cardWindow';

const NOW = new Date('2026-11-12T19:00:00.000Z');
const LATEST = '2026-11-15T19:00:00.000Z';

describe('card window client', () => {
  it('keeps the cutoff day and blocks the next local midnight', () => {
    expect(cardDayBlocked('2026-11-15', LATEST, 'Africa/Douala')).toBe(false);
    expect(cardDayBlocked('2026-11-16', LATEST, 'Africa/Douala')).toBe(true);
    expect(cardDayBlocked('2026-11-16', null, 'Africa/Douala')).toBe(false);
  });

  it('drops the cap for charge at pickup and for mobile money until card is selected', () => {
    const stripe = {
      mode: 'authorize_upfront' as const,
      payment_rail: 'stripe' as const,
      inspection_enabled: true,
      latest_card_end_at: LATEST,
      timezone: 'Africa/Douala',
    };
    expect(effectiveCardEnd(stripe, true, NOW)).toBe(LATEST);
    expect(effectiveCardEnd({ ...stripe, mode: 'charge_at_pickup', latest_card_end_at: null }, true, NOW)).toBeNull();
    const momo = {
      mode: 'authorize_upfront' as const,
      payment_rail: 'mobile_money' as const,
      inspection_enabled: true,
      latest_card_end_at: null,
      card_auth_window_days: 6,
      stripe_review_hours: 72,
      timezone: 'Africa/Douala',
    };
    expect(effectiveCardEnd(momo, false, NOW)).toBeNull();
    expect(effectiveCardEnd(momo, true, NOW)).toBe(LATEST);
  });

  it('maps both rejection codes and never returns the raw sentence', () => {
    const error = {
      response: {
        data: {
          code: 'RENTAL_STRIPE_BOOKING_WINDOW_EXCEEDED',
          message: 'Card payments support rentals ending within 6 days',
          latest_card_end_at: LATEST,
          timezone: 'Africa/Douala',
        },
      },
    };
    const en = cardWindowErrorMessage(error, 'en');
    const fr = cardWindowErrorMessage(
      { data: { code: 'RENTAL_INSPECTION_STRIPE_WINDOW', latest_card_end_at: LATEST, timezone: 'Africa/Douala' } },
      'fr'
    );
    expect(en).toBe('With a card, this rental must end by 15 Nov · 20:00. Choose earlier dates.');
    expect(fr).toBe('Avec une carte, cette location doit se terminer le 15 nov. · 20:00. Choisissez des dates plus tôt.');
    expect(en).not.toContain('6 days');
    expect(cardWindowErrorMessage({ message: 'raw' }, 'en')).toBeNull();
    expect(formatCardCutoff(LATEST, 'Africa/Douala', 'en')).toBe('15 Nov · 20:00');
    expect(cardWindowNote('15 Nov · 20:00', 'en')).toContain('15 Nov · 20:00');
    expect(cardWindowSendReason('en')).toBe('Change dates to send your request.');
    expect(cardWindowSendReason('fr')).toBe('Modifiez les dates pour envoyer votre demande.');
    expect(cardWindowSendReason('en')).not.toContain('15 Nov');
    expect(cardEndMisses('2026-11-17T19:00:00.000Z', LATEST)).toBe(true);
    expect(cardEndMisses('2026-11-15T19:00:00.000Z', LATEST)).toBe(false);
    expect(cardEndMisses('2026-11-20T00:00:00.000Z', null)).toBe(false);
  });
});
