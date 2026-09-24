import {
  progressWindow,
  salesCompletionPercent,
  sumUniqueAmounts,
} from './payment-schedule-progress.service';

describe('salesCompletionPercent', () => {
  it('returns null without a sales target', () => {
    expect(salesCompletionPercent(1000, null)).toBeNull();
    expect(salesCompletionPercent(1000, 0)).toBeNull();
  });

  it('returns sales-only percent capped at 100', () => {
    expect(salesCompletionPercent(2500, 10000)).toBe(25);
    expect(salesCompletionPercent(15000, 10000)).toBe(100);
  });
});

describe('progressWindow', () => {
  it('starts at the later of starts_at and accepted_at', () => {
    const window = progressWindow(
      '2026-01-01T00:00:00.000Z',
      '2026-01-10T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      new Date('2026-01-20T00:00:00.000Z')
    );
    expect(window.from).toBe('2026-01-10T00:00:00.000Z');
    expect(window.to).toBe('2026-01-20T00:00:00.000Z');
  });
});

describe('sumUniqueAmounts', () => {
  it('deduplicates by id and respects exclude set', () => {
    const rows = [
      { id: 'a', subtotal: 100 },
      { id: 'b', subtotal: 50 },
      { id: 'a', subtotal: 100 },
    ];
    expect(
      sumUniqueAmounts(
        rows,
        (row) => row.id,
        (row) => row.subtotal,
        new Set(['b'])
      )
    ).toBe(100);
  });
});
