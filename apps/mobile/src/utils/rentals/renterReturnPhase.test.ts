import { formatDoualaStamp, listReturnChip, renterReturnPhase } from './renterReturnPhase';

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

  it('formats Douala time', () => {
    expect(formatDoualaStamp('2026-11-12T19:00:00.000Z', 'en')).toContain('20:00');
    expect(formatDoualaStamp('2026-11-12T19:00:00.000Z', 'fr')).toContain('20:00');
  });
});
