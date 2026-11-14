import { floorCardInstant, startTooSoon, suggestionCap } from './assistant-rental-suggestion';

const ZONE = 'America/Toronto';

describe('card suggestion start', () => {
  const late = new Date('2026-11-14T04:30:00.000Z');
  const noon = new Date('2026-11-13T17:00:00.000Z');

  it('rejects a past day and a day with under 2 hours left', () => {
    expect(startTooSoon('2026-11-12', late, ZONE)).toBe(true);
    expect(startTooSoon('2026-11-13', late, ZONE)).toBe(true);
    expect(startTooSoon('2026-11-14', late, ZONE)).toBe(false);
    expect(startTooSoon('2026-11-13', noon, ZONE)).toBe(false);
  });

  it('caps the suggestion on the rounded-down cutoff', () => {
    const latest = '2026-11-16T03:48:00.000Z';
    expect(floorCardInstant(latest, ZONE)).toBe('2026-11-16T03:00:00.000Z');
    expect(suggestionCap(latest, ZONE)).toBe('2026-11-15');
  });
});
