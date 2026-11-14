import { formatDoualaStamp, listReturnChip, renterReturnPhase } from './renterReturnPhase';

const end = '2026-11-12T19:00:00.000Z';
const before = new Date('2026-11-12T18:00:00.000Z');
const after = new Date('2026-11-12T20:00:00.000Z');
const reported = '2026-11-12T18:42:00.000Z';
const day = 24 * 60 * 60 * 1000;

describe('renterReturnPhase', () => {
  it('hides an active rental until the end instant and shows it at that instant', () => {
    expect(renterReturnPhase({ status: 'active', endAt: end, now: new Date(new Date(end).getTime() - 1) })).toBe('hidden');
    expect(renterReturnPhase({ status: 'active', endAt: end, now: new Date(end) })).toBe('overdue');
    expect(renterReturnPhase({ status: 'active', endAt: 'not-a-date', now: after })).toBe('hidden');
    expect(renterReturnPhase({ status: 'reserved', endAt: end, now: after })).toBe('hidden');
    expect(renterReturnPhase({ status: 'completed', endAt: end, reportedAt: reported, now: after })).toBe('hidden');
  });

  it('shows due before the end on awaiting return, including a bad end', () => {
    expect(renterReturnPhase({ status: 'awaiting_return', endAt: end, now: new Date(new Date(end).getTime() - 1) })).toBe('due');
    expect(renterReturnPhase({ status: 'awaiting_return', endAt: end, now: new Date(end) })).toBe('overdue');
    expect(renterReturnPhase({ status: 'awaiting_return', endAt: null, now: after })).toBe('due');
    expect(renterReturnPhase({ status: 'awaiting_return', endAt: 'not-a-date', now: after })).toBe('due');
  });

  it('waits until 24 hours and escalates at that instant or when support already stamped it', () => {
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
  });

  it('lists Overdue only before a report and hides the chip once escalated', () => {
    expect(listReturnChip({ status: 'awaiting_return', endAt: end, now: before })).toBeNull();
    expect(listReturnChip({ status: 'active', endAt: end, now: new Date(end) })).toBe('overdue');
    expect(listReturnChip({ status: 'active', endAt: end, reportedAt: reported, now: after })).toBe('waiting');
    expect(listReturnChip({
      status: 'awaiting_return',
      endAt: end,
      reportedAt: reported,
      escalatedAt: reported,
      now: after,
    })).toBeNull();
    expect(listReturnChip({ status: 'completed', endAt: end, now: after })).toBeNull();
  });

  it('returns nothing for a stamp that is not a date', () => {
    expect(formatDoualaStamp('not-a-date', 'en')).toBe('');
    expect(formatDoualaStamp('2026-11-12T19:00:00.000Z', 'en')).toContain('20:00');
  });
});
