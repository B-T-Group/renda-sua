import {
  formatRequestAmount,
  formatRequestChipDay,
  formatRequestChipWeekday,
  formatRequestDay,
  requestChipDateKeys,
  requestChipSelected,
  requestDayCount,
  requestPriceCopy,
  requestSelectionLabel,
  requestUsesDayWording,
  selectedRequestDateKeys,
  formatChangeDetail,
  formatRentalPeriod,
  readPriceConfirmQuote,
} from './rentalRequestFormat';

describe('formatRequestAmount', () => {
  it('puts the amount before FCFA in English and French', () => {
    expect(formatRequestAmount(760, 'XAF', 'en')).toBe('760 FCFA');
    expect(formatRequestAmount(380, 'FCFA', 'fr')).toBe('380 FCFA');
    expect(formatRequestAmount(1140, 'XAF', 'en')).toBe('1 140 FCFA');
    expect(formatRequestAmount(1140, 'XAF', 'fr')).toBe('1 140 FCFA');
  });

  it('does not put the currency code in front', () => {
    expect(formatRequestAmount(760, 'XAF', 'en').startsWith('FCFA')).toBe(false);
    expect(formatRequestAmount(760, 'XAF', 'fr').startsWith('FCFA')).toBe(false);
  });

  it('keeps a minus and a zero, and treats a fr-CM tag as French', () => {
    expect(formatRequestAmount(0, 'XAF', 'en')).toBe('0 FCFA');
    expect(formatRequestAmount(-2500, 'XAF', 'en')).toBe('-2 500 FCFA');
    expect(formatRequestAmount(-2500, 'xaf', 'fr-CM')).toBe('-2 500 FCFA');
  });
});

describe('formatRequestDay', () => {
  it('formats the scaffold dates as human weekdays, never ISO', () => {
    expect(formatRequestDay('2026-11-11', 'en')).toBe('Wed 11 Nov');
    expect(formatRequestDay('2026-11-12', 'en')).toBe('Thu 12 Nov');
    expect(formatRequestDay('2026-11-11', 'fr')).toBe('Mer. 11 nov.');
    expect(formatRequestDay('2026-11-12', 'fr')).toBe('Jeu. 12 nov.');
    expect(formatRequestDay('2026-11-11', 'en')).not.toContain('2026-11-11');
  });

  it('splits a chip into weekday and day number', () => {
    expect(formatRequestChipWeekday('2026-11-10', 'en')).toBe('Tue');
    expect(formatRequestChipDay('2026-11-10')).toBe('10');
    expect(formatRequestChipWeekday('2026-11-11', 'fr')).toBe('Mer.');
  });

  it('leaves a string that is not a calendar day unchanged and drops a leading zero on the chip', () => {
    expect(formatRequestDay('nope', 'en')).toBe('nope');
    expect(formatRequestDay('2026-11-11T00:00:00Z', 'en')).toBe('2026-11-11T00:00:00Z');
    expect(formatRequestChipWeekday('', 'en')).toBe('');
    expect(formatRequestChipDay('2026-11-05')).toBe('5');
    expect(formatRequestChipDay('05')).toBe('05');
  });
});

describe('request day wording', () => {
  const days = [
    { billing: 'all_day' as const },
    { billing: 'all_day' as const },
  ];

  it('uses day wording for a daily-rate booking', () => {
    expect(requestUsesDayWording(days)).toBe(true);
    expect(requestDayCount(days)).toBe(2);
  });

  it('keeps hourly wording when any window is hourly', () => {
    expect(requestUsesDayWording([])).toBe(false);
    expect(requestUsesDayWording([{ billing: 'hourly' }])).toBe(false);
    expect(requestUsesDayWording([...days, { billing: 'hourly' }])).toBe(false);
    expect(requestDayCount([])).toBe(0);
    expect(requestDayCount([...days, { billing: 'hourly' }])).toBe(2);
  });
});

describe('request chip selection', () => {
  const selected = selectedRequestDateKeys([
    { calendarDate: '2026-11-11', startMs: 0 },
    { calendarDate: '2026-11-12', startMs: 0 },
  ]);

  it('highlights the chosen dates and not today', () => {
    expect(selected).toEqual(['2026-11-11', '2026-11-12']);
    expect(requestChipSelected('2026-11-11', selected)).toBe(true);
    expect(requestChipSelected('2026-11-12', selected)).toBe(true);
    expect(requestChipSelected('2026-11-10', selected)).toBe(false);
  });

  it('highlights today only when today was chosen', () => {
    const today = ['2026-11-10'];
    expect(requestChipSelected('2026-11-10', today)).toBe(true);
    expect(requestChipSelected('2026-11-11', today)).toBe(false);
  });

  it('keeps chosen days in the chip window even when they are outside the next 14 days', () => {
    const keys = requestChipDateKeys('2026-12-01', ['2026-11-11', '2026-11-12']);
    expect(keys).toContain('2026-11-11');
    expect(keys).toContain('2026-11-12');
    expect(keys).toContain('2026-12-01');
    expect(keys.indexOf('2026-11-11')).toBeLessThan(keys.indexOf('2026-12-01'));
  });

  it('drops a chosen key that is not a date and still lists a chosen day when the window span is zero', () => {
    expect(requestChipDateKeys('2026-12-01', ['nope', '2026-11-11'], 0)).toEqual(['2026-11-11']);
  });

  it('lists each chosen day once and falls back to the selection instant when the calendar date is unusable', () => {
    expect(
      selectedRequestDateKeys([
        { calendarDate: '2026-11-11', startMs: 0 },
        { calendarDate: '2026-11-11', startMs: 5 },
      ])
    ).toEqual(['2026-11-11']);
    expect(
      selectedRequestDateKeys([{ calendarDate: 'bad', startMs: Date.UTC(2026, 10, 11, 15, 0, 0) }])
    ).toEqual(['2026-11-11']);
  });
});

const copy = (key: string, fallback: string, options?: Record<string, unknown>) =>
  fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? ''));

describe('request price copy', () => {
  const day = {
    id: 'd1',
    startMs: 0,
    endMs: 0,
    billing: 'all_day' as const,
    calendarDate: '2026-11-11',
  };

  it('shows an em dash and no breakdown before a day is chosen', () => {
    expect(
      requestPriceCopy({
        rows: [],
        hours: 0,
        units: 1,
        total: 0,
        dayRate: 380,
        hourRate: 16,
        currency: 'XAF',
        language: 'en',
        t: copy,
      })
    ).toEqual({ totalAmount: '—' });
  });

  it('writes the day rate after the amount and multiplies only when more than one unit is requested', () => {
    const one = requestPriceCopy({
      rows: [day, { ...day, id: 'd2', calendarDate: '2026-11-12' }],
      hours: 16,
      units: 1,
      total: 760,
      dayRate: 380,
      hourRate: 16,
      currency: 'XAF',
      language: 'en',
      t: copy,
    });
    expect(one.priceLabel).toBe('2 days × 380 FCFA / day');
    expect(one.priceAmount).toBe('760 FCFA');
    expect(one.hoursCaption).toBeUndefined();

    const two = requestPriceCopy({
      rows: [day],
      hours: 8,
      units: 2,
      total: 760,
      dayRate: 380,
      hourRate: 16,
      currency: 'XAF',
      language: 'en',
      t: copy,
    });
    expect(two.priceLabel).toBe('1 days × 380 FCFA / day × 2');
  });

  it('keeps the hourly caption and a negative total sign', () => {
    const hourly = requestPriceCopy({
      rows: [{ ...day, billing: 'hourly', calendarDate: undefined }],
      hours: 8,
      units: 3,
      total: -128,
      dayRate: 380,
      hourRate: 16,
      currency: 'XAF',
      language: 'en',
      t: copy,
    });
    expect(hourly.priceLabel).toBe('8 h × 16 FCFA / hour × 3');
    expect(hourly.hoursCaption).toBe('8 billable hours total');
    expect(hourly.totalAmount).toBe('-128 FCFA');
    expect(hourly.priceLabel?.startsWith('FCFA')).toBe(false);
  });

  it('labels an all-day chip with the weekday and the all-day word', () => {
    expect(requestSelectionLabel(day, 'en', 'All day')).toBe('Wed 11 Nov · All day');
    expect(
      requestSelectionLabel({ ...day, calendarDate: 'bad', startMs: Date.UTC(2026, 10, 11, 15) }, 'en', 'All day')
    ).toBe('Wed 11 Nov · All day');
  });
});

const days = (count: number) => (count === 1 ? '1 day' : `${count} days`);
const jours = (count: number) => (count === 1 ? '1 jour' : `${count} jours`);

describe('formatRentalPeriod', () => {
  const daily = [
    { billing: 'all_day', calendar_date: '2026-11-15', start_at: '2026-11-15T00:00:00.000Z', end_at: '2026-11-16T00:00:00.000Z' },
    { billing: 'all_day', calendar_date: '2026-11-16', start_at: '2026-11-16T00:00:00.000Z', end_at: '2026-11-17T00:00:00.000Z' },
  ];

  it('shows a daily range through the last booked day, not the exclusive end', () => {
    expect(formatRentalPeriod(daily, 'en', days)).toBe('15\u201316 Nov · 2 days');
    expect(formatRentalPeriod(daily, 'fr', jours)).toBe('15\u201316 nov. · 2 jours');
    expect(formatRentalPeriod(daily, 'en', days)).not.toMatch(/PM|AM|2026/);
    const threeDays = [
      ...daily,
      { billing: 'all_day', calendar_date: '2026-11-17', start_at: '2026-11-17T00:00:00.000Z', end_at: '2026-11-18T00:00:00.000Z' },
    ];
    expect(formatRentalPeriod(threeDays, 'en', days)).toBe('15\u201317 Nov · 3 days');
    expect(formatRentalPeriod([daily[0]], 'en', days)).toBe('15 Nov · 1 day');
  });

  it('shows hourly bookings as a listing wall-clock range', () => {
    const hourly = [{
      billing: 'hourly',
      start_at: '2026-11-15T10:00:00.000Z',
      end_at: '2026-11-15T14:00:00.000Z',
    }];
    expect(formatRentalPeriod(hourly, 'en', days)).toBe('15 Nov · 10:00\u201314:00');
  });

  it('lists only the fields that changed', () => {
    const detail = formatChangeDetail({
      fields: ['dates'],
      dates: {
        from: daily,
        to: [
          ...daily,
          { billing: 'all_day', calendar_date: '2026-11-17', start_at: '2026-11-17T00:00:00.000Z', end_at: '2026-11-18T00:00:00.000Z' },
        ],
      },
    }, 'en');
    expect(detail).toBe('dates 15\u201316 → 15\u201317 Nov');
  });
});

describe('readPriceConfirmQuote', () => {
  it('reads the server quote only from PRICE_CONFIRM_REQUIRED', () => {
    expect(readPriceConfirmQuote({
      code: 'PRICE_CONFIRM_REQUIRED',
      data: { quote: { total: 1140, currency: 'XAF', previousTotal: 760 } },
    })).toEqual({ total: 1140, currency: 'XAF', previousTotal: 760 });
    expect(readPriceConfirmQuote({ code: 'RENTAL_REQUEST_UNAVAILABLE' })).toBeNull();
  });
});
