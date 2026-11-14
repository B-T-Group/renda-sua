import { cardWindowInsteadReply, cardWindowUnfitReply, formatCardCutoff, formatSuggestedRange } from './assistant-rental-card-copy';
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

  it('labels a different range as dates that work instead', () => {
    const frCutoff = formatCardCutoff(latestCardEndAt(NOW).toISOString(), ZONE, 'fr');
    expect(cardWindowInsteadReply('en', cutoff)).toBe(
      `With a card, this rental must end by ${cutoff}. These dates work instead:`
    );
    expect(cardWindowInsteadReply('fr', frCutoff)).toBe(
      `Avec une carte, cette location doit se terminer le ${frCutoff}. Ces dates conviennent à la place :`
    );
  });

  it('rounds the cutoff down to the hour and names the city once', () => {
    const iso = '2026-11-16T03:48:00.000Z';
    expect(formatCardCutoff(iso, 'America/Toronto', 'en')).toBe('15 Nov · 22:00 (Toronto time)');
    expect(formatCardCutoff(iso, 'America/Toronto', 'fr')).toBe('15 nov. · 22:00 (heure de Toronto)');
  });

  it('formats a suggestion like the active range chip', () => {
    expect(formatSuggestedRange('2026-11-13', '2026-11-15', 2, 'en')).toBe('13 Nov → 15 Nov · 2 days');
    expect(formatSuggestedRange('2026-11-13', '2026-11-15', 2, 'fr')).toBe('13 nov. → 15 nov. · 2 jours');
    expect(formatSuggestedRange('2026-11-17', '2026-11-18', 1, 'en')).toBe('17 Nov → 18 Nov · 1 day');
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
