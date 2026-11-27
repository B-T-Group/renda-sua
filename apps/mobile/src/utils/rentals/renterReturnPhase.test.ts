import { formatReturnStamp, listReturnChip, renterReturnPhase } from './renterReturnPhase';

const end = '2026-11-12T19:00:00.000Z';
const before = new Date('2026-11-12T18:00:00.000Z');
const after = new Date('2026-11-12T20:00:00.000Z');
const reported = '2026-11-12T18:42:00.000Z';

describe('renterReturnPhase', () => {
  it('hides the card until return is due', () => {
    expect(renterReturnPhase({ status: 'active', endAt: end, now: before })).toBe('hidden');
    expect(renterReturnPhase({ status: 'completed', endAt: end, now: after })).toBe('hidden');
  });

  it('shows due, overdue, waiting, and escalated', () => {
    expect(renterReturnPhase({ status: 'awaiting_return', endAt: end, now: before })).toBe('due');
    expect(renterReturnPhase({ status: 'active', endAt: end, now: after })).toBe('overdue');
    expect(
      renterReturnPhase({ status: 'awaiting_return', endAt: end, reportedAt: reported, now: after })
    ).toBe('waiting');
    const dayLater = new Date(new Date(reported).getTime() + 24 * 60 * 60 * 1000);
    expect(
      renterReturnPhase({ status: 'awaiting_return', endAt: end, reportedAt: reported, now: dayLater })
    ).toBe('escalated');
  });

  it('lists Overdue and Waiting chips', () => {
    expect(listReturnChip({ status: 'awaiting_return', endAt: end, now: after })).toBe('overdue');
    expect(listReturnChip({ status: 'active', endAt: end, reportedAt: reported, now: after })).toBe(
      'waiting'
    );
    expect(listReturnChip({ status: 'completed', endAt: end, now: after })).toBeNull();
  });

  it('formats the report time on the listing clock', () => {
    // 20:40Z is 15:40 in Toronto (EST) and 21:40 in Douala.
    expect(formatReturnStamp('2026-11-26T20:40:00.000Z', 'en', 'America/Toronto')).toBe('26 Nov · 15:40');
    expect(formatReturnStamp('2026-11-26T20:40:00.000Z', 'en', 'Africa/Douala')).toBe('26 Nov · 21:40');
    expect(formatReturnStamp('2026-11-26T20:40:00.000Z', 'en', null)).toBe('26 Nov · 21:40');
    // A stored wall clock reads as typed with 'UTC'.
    expect(formatReturnStamp('2026-11-26T18:00:00.000Z', 'en', 'UTC')).toBe('26 Nov · 18:00');
  });

  it('formats Douala time', () => {
    expect(formatReturnStamp('2026-11-12T19:00:00.000Z', 'en')).toContain('20:00');
    expect(formatReturnStamp('2026-11-12T19:00:00.000Z', 'fr')).toContain('20:00');
    expect(formatReturnStamp('not-a-date', 'en')).toBe('');
  });

  it('opens at the end instant and escalates at 24 hours', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(renterReturnPhase({ status: 'active', endAt: end, now: new Date(new Date(end).getTime() - 1) })).toBe('hidden');
    expect(renterReturnPhase({ status: 'active', endAt: end, now: new Date(end) })).toBe('overdue');
    expect(renterReturnPhase({ status: 'awaiting_return', endAt: null, now: after })).toBe('due');
    expect(renterReturnPhase({ status: 'active', endAt: 'not-a-date', now: after })).toBe('hidden');
    const almost = new Date(new Date(reported).getTime() + day - 1);
    const exact = new Date(new Date(reported).getTime() + day);
    expect(renterReturnPhase({ status: 'awaiting_return', endAt: end, reportedAt: reported, now: almost })).toBe('waiting');
    expect(renterReturnPhase({ status: 'awaiting_return', endAt: end, reportedAt: reported, now: exact })).toBe('escalated');
    expect(renterReturnPhase({
      status: 'active',
      endAt: end,
      reportedAt: reported,
      escalatedAt: reported,
      now: after,
    })).toBe('escalated');
    expect(listReturnChip({ status: 'active', endAt: end, now: new Date(end) })).toBe('overdue');
    expect(listReturnChip({
      status: 'awaiting_return',
      endAt: end,
      reportedAt: reported,
      escalatedAt: reported,
      now: after,
    })).toBeNull();
  });
});

describe('renterReturnPhase on the listing clock', () => {
  // 15:00 Toronto wall clock stored as UTC components = 20:00Z real.
  const torontoEnd = '2026-11-26T15:00:00.000Z';
  it('is not overdue in Toronto until 3 PM Toronto', () => {
    const at = (iso: string) => renterReturnPhase({ status: 'active', endAt: torontoEnd, now: new Date(iso), timeZone: 'America/Toronto' });
    expect(at('2026-11-26T15:00:00.000Z')).toBe('hidden');
    expect(at('2026-11-26T19:59:00.000Z')).toBe('hidden');
    expect(at('2026-11-26T20:00:00.000Z')).toBe('overdue');
  });

  it('flags a Manila return at 3 PM Manila, not 11 PM', () => {
    const chip = (iso: string) => listReturnChip({ status: 'active', endAt: torontoEnd, now: new Date(iso), timeZone: 'Asia/Manila' });
    expect(chip('2026-11-26T06:59:00.000Z')).toBeNull();
    expect(chip('2026-11-26T07:00:00.000Z')).toBe('overdue');
  });
});
