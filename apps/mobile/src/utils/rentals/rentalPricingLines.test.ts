import {
  computeRentalPricingLines,
  estimateTotalFromSelectionRanges,
  parseRentalSelectionWindowsFromJson,
} from './rentalPricingLines';

const HOUR = 3_600_000;
const start = Date.UTC(2026, 10, 14, 10, 0, 0);

describe('estimateTotalFromSelectionRanges', () => {
  it('bills at least one hour and rounds a partial hour up', () => {
    const half = estimateTotalFromSelectionRanges(
      [{ startMs: start, endMs: start + 30 * 60 * 1000, billing: 'hourly' }],
      16,
      380
    );
    expect(half.total).toBe(16);
    expect(half.lines[0]).toMatchObject({ kind: 'hourly', billableHours: 1, subtotal: 16 });

    const exact = estimateTotalFromSelectionRanges(
      [{ startMs: start, endMs: start + HOUR, billing: 'hourly' }],
      10.1,
      0
    );
    expect(exact.total).toBe(10.1);

    const over = estimateTotalFromSelectionRanges(
      [{ startMs: start, endMs: start + HOUR + 1, billing: 'hourly' }],
      10,
      0,
      2
    );
    expect(over.total).toBe(40);
    expect(over.lines[0]).toMatchObject({ billableHours: 2, subtotal: 40 });
  });

  it('does not charge a negative total when the window runs backwards', () => {
    const quoted = estimateTotalFromSelectionRanges(
      [{ startMs: start + HOUR, endMs: start, billing: 'hourly' }],
      16,
      380,
      3
    );
    expect(quoted.total).toBe(48);
    expect(quoted.lines[0]).toMatchObject({ billableHours: 1 });
  });

  it('floors the unit count at 1 and multiplies an all-day rate by whole units', () => {
    const day = {
      startMs: start,
      endMs: start + HOUR,
      billing: 'all_day' as const,
      calendarDate: '2026-11-14',
    };
    expect(estimateTotalFromSelectionRanges([day], 16, 10.1, 2).total).toBe(20.2);
    expect(estimateTotalFromSelectionRanges([day, { ...day, calendarDate: '2026-11-15' }], 16, 10.1, 2).total).toBe(
      40.4
    );
    expect(estimateTotalFromSelectionRanges([day], 16, 380, 0).total).toBe(380);
    expect(estimateTotalFromSelectionRanges([day], 16, 380, 2.9).total).toBe(760);
    expect(estimateTotalFromSelectionRanges([day], 16, 380, Number.NaN).total).toBe(380);
    expect(estimateTotalFromSelectionRanges([day], 16, 380, -3).total).toBe(380);
    expect(estimateTotalFromSelectionRanges([], 16, 380, 2).total).toBe(0);
  });

  it('bills an all-day row with no calendar date by the hour', () => {
    const quoted = estimateTotalFromSelectionRanges(
      [{ startMs: start, endMs: start + 30 * 60 * 1000, billing: 'all_day' }],
      16,
      380,
      2
    );
    expect(quoted.total).toBe(32);
    expect(quoted.lines[0].kind).toBe('hourly');
  });
});

describe('computeRentalPricingLines', () => {
  it('refuses an all-day window that has no calendar date', () => {
    expect(() =>
      computeRentalPricingLines(
        [{ start: new Date(start), end: new Date(start + HOUR), billing: 'all_day' }],
        16,
        380
      )
    ).toThrow('all_day window missing calendar_date');
  });

  it('bills a partial hour as one hour', () => {
    const priced = computeRentalPricingLines(
      [
        {
          start: new Date(start),
          end: new Date(start + 20 * 60 * 1000),
          billing: 'hourly',
        },
      ],
      10.1,
      380
    );
    expect(priced.total).toBe(10.1);
    expect(priced.lines[0]).toMatchObject({ billableHours: 1, subtotal: 10.1 });
  });
});

describe('parseRentalSelectionWindowsFromJson', () => {
  it('returns no windows for an empty or non-array payload', () => {
    expect(parseRentalSelectionWindowsFromJson(null)).toEqual([]);
    expect(parseRentalSelectionWindowsFromJson([])).toEqual([]);
    expect(parseRentalSelectionWindowsFromJson({})).toEqual([]);
  });

  it('keeps an all-day calendar date and treats any other billing as hourly', () => {
    const rows = parseRentalSelectionWindowsFromJson([
      {
        start_at: '2026-11-14T09:00:00.000Z',
        end_at: '2026-11-14T18:00:00.000Z',
        billing: 'all_day',
        calendar_date: '2026-11-14',
      },
      {
        start_at: '2026-11-15T09:00:00.000Z',
        end_at: '2026-11-15T12:00:00.000Z',
        billing: 'weekly',
      },
    ]);
    expect(rows[0]).toMatchObject({ billing: 'all_day', calendarDate: '2026-11-14' });
    expect(rows[1]).toMatchObject({ billing: 'hourly', calendarDate: undefined });
  });
});
