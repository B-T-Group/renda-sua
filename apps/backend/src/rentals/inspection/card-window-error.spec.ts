import { HttpException } from '@nestjs/common';
import { cardWindowRejected } from './rental-inspection.errors';
import { resolveCardPaymentPolicy } from '../rental-card-window';
import { parseSearchDateRange } from '../rental-search.dates';
import {
  assistantCardWindowCopy,
  formatAssistantStay,
  formatCardCutoff,
  friendlyCardWindowCopy,
  isCardWindowCode,
  suggestedCardStay,
} from './card-window.copy';

const NOW = new Date('2026-11-12T19:00:00.000Z');
const fields = {
  ...resolveCardPaymentPolicy({
    rail: 'stripe',
    timezone: 'Africa/Douala',
    now: NOW,
    reviewHours: 72,
    inspected: true,
  }),
  inspection_enabled: true,
  card_auth_window_days: 6,
};

describe('card window error mapping', () => {
  it('puts the stable code and the cutoff on both window rejections', () => {
    const inspection = cardWindowRejected('RENTAL_INSPECTION_STRIPE_WINDOW', 'raw inspection', fields);
    const legacy = cardWindowRejected('RENTAL_STRIPE_BOOKING_WINDOW_EXCEEDED', 'raw legacy', fields);
    for (const error of [inspection, legacy]) {
      const body = (error as HttpException).getResponse() as Record<string, unknown>;
      expect(isCardWindowCode(body.code)).toBe(true);
      expect(body.latest_card_end_at).toBe('2026-11-15T19:00:00.000Z');
      expect(body.timezone).toBe('Africa/Douala');
      expect(body.mode).toBe('authorize_upfront');
      expect(body.payment_rail).toBe('stripe');
      expect(body.momo_available).toBe(false);
      expect(body.stripe_review_hours).toBe(72);
      expect(String(body.message)).not.toContain('15 Nov');
    }
  });

  it('maps both codes to the friendly cutoff and never the raw sentence', () => {
    const en = friendlyCardWindowCopy({
      code: 'RENTAL_INSPECTION_STRIPE_WINDOW',
      latestCardEndAt: fields.latest_card_end_at,
      timezone: fields.timezone,
      locale: 'en',
    });
    const fr = friendlyCardWindowCopy({
      code: 'RENTAL_STRIPE_BOOKING_WINDOW_EXCEEDED',
      latestCardEndAt: fields.latest_card_end_at,
      timezone: 'Africa/Douala',
      locale: 'fr',
    });
    expect(en).toBe('With a card, this rental must end by 15 Nov · 20:00. Choose earlier dates.');
    expect(fr).toBe('Avec une carte, cette location doit se terminer le 15 nov. · 20:00. Choisissez des dates plus tôt.');
    expect(en).not.toContain('72-hour');
    expect(fr).not.toContain('6 days');
    expect(friendlyCardWindowCopy({ code: 'OTHER', latestCardEndAt: null, timezone: 'UTC', locale: 'en' })).toBeNull();
  });

  it('counts the suggested stay with the rental search duration and ends by the cutoff', () => {
    const latest = '2026-11-15T19:00:00.000Z';
    const stay = suggestedCardStay(latest, 'Africa/Douala', NOW);
    const range = parseSearchDateRange(stay?.start, stay?.end);
    expect(parseSearchDateRange('2026-11-17', '2026-11-18')?.dayCount).toBe(1);
    expect(stay).toEqual({ start: '2026-11-13', end: '2026-11-15', dayCount: 2 });
    expect(stay?.dayCount).toBe(range?.dayCount);
    expect(range && range.endMs <= Date.parse(latest)).toBe(true);
    const cutoff = formatCardCutoff(latest, 'Africa/Douala', 'en');
    expect(cutoff).toBe('15 Nov · 20:00');
    expect(assistantCardWindowCopy(cutoff, 'en')).toBe(
      'With a card, this rental must end by 15 Nov · 20:00. Here are dates that work:'
    );
    expect(assistantCardWindowCopy(formatCardCutoff(latest, 'Africa/Douala', 'fr'), 'fr')).toBe(
      'Avec une carte, cette location doit se terminer le 15 nov. · 20:00. Voici des dates possibles :'
    );
    expect(formatAssistantStay(stay!, 'en')).toBe('13 Nov → 15 Nov · 2 days');
    expect(formatAssistantStay(stay!, 'en')).not.toContain('inspected');
  });
});
