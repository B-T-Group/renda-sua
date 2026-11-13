import { cardWindowUnfitReply, formatCardCutoff } from './assistant-rental-card-copy';
import { clampExclusiveRange, exclusiveEndInstant, latestCardEndAt } from '../rentals/rental-card-window';

const NOW = new Date('2026-11-13T12:00:00.000Z');
const ZONE = 'Africa/Douala';

describe('card window assistant copy', () => {
  const cutoff = formatCardCutoff(latestCardEndAt(NOW).toISOString(), ZONE, 'en');

  it('uses the cutoff sentence and never says inspected rental', () => {
    const en = cardWindowUnfitReply('en', cutoff);
    const fr = cardWindowUnfitReply('fr', formatCardCutoff(latestCardEndAt(NOW).toISOString(), ZONE, 'fr'));
    expect(en).toBe(`With a card, this rental must end by ${cutoff}. Here are dates that work:`);
    expect(fr).toBe(`Avec une carte, cette location doit se terminer le ${formatCardCutoff(latestCardEndAt(NOW).toISOString(), ZONE, 'fr')}. Voici des dates possibles :`);
    expect(en.toLowerCase()).not.toContain('inspected');
    expect(fr.toLowerCase()).not.toContain('inspect');
  });

  it('counts 17–18 Nov as 1 day and 13–15 Nov as 2 days', () => {
    const one = clampExclusiveRange({
      startDate: '2026-11-17',
      endDate: '2026-11-18',
      dayCount: 9,
      latestCardEndAt: null,
      zone: ZONE,
      today: '2026-11-13',
    });
    const two = clampExclusiveRange({
      startDate: '2026-11-13',
      endDate: '2026-11-15',
      dayCount: 9,
      latestCardEndAt: null,
      zone: ZONE,
      today: '2026-11-13',
    });
    expect(one.offer).toEqual({ startDate: '2026-11-17', endDate: '2026-11-18', dayCount: 1 });
    expect(two.offer).toEqual({ startDate: '2026-11-13', endDate: '2026-11-15', dayCount: 2 });
  });

  it('keeps the suggested end on or before latest_card_end_at', () => {
    const latest = latestCardEndAt(NOW).toISOString();
    const offered = clampExclusiveRange({
      startDate: '2026-11-14',
      endDate: '2026-11-20',
      dayCount: 6,
      latestCardEndAt: latest,
      zone: ZONE,
      today: '2026-11-13',
    });
    expect(offered.fits).toBe(false);
    expect(offered.offer?.endDate).toBe('2026-11-16');
    expect(offered.offer?.dayCount).toBe(2);
    expect(exclusiveEndInstant(offered.offer!.endDate, ZONE).getTime()).toBeLessThanOrEqual(Date.parse(latest));
  });
});
