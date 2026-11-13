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
  bookingPeriodWindows,
  bookingRequestedPeriodLines,
  clientRequestPeriodLines,
  formatChangeDetail,
  formatListingDeadline,
  formatListingDue,
  formatRentalDateRange,
  formatRentalPeriod,
  isSingleRequestedPeriod,
  LISTING_TIME_ZONE,
  modifySaveNeedsConfirm,
  rentalEditWindowOpen,
  rentalSelectionFingerprint,
  RENTAL_EDIT_LEAD_MS,
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

  it('groups XAF and XOF with a space and an FCFA suffix, and leaves USD alone', () => {
    expect(formatRequestAmount(45000, 'XAF', 'en')).toBe('45 000 FCFA');
    expect(formatRequestAmount(45000.4, 'XAF', 'en')).toBe('45 000 FCFA');
    expect(formatRequestAmount(45000.5, 'xaf', 'fr')).toBe('45 001 FCFA');
    expect(formatRequestAmount(1000000, 'FCFA', 'en')).toBe('1 000 000 FCFA');
    expect(formatRequestAmount(55000, 'XOF', 'fr')).toBe('55 000 FCFA');
    expect(formatRequestAmount(260, 'USD', 'en')).not.toMatch(/FCFA/);
    expect(formatRequestAmount(260, 'USD', 'fr')).not.toMatch(/FCFA/);
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

  it('shows a daily range in the listing calendar, not a device clock', () => {
    expect(formatRentalPeriod(daily, 'en', days)).toBe('15\u201316 Nov · 2 days');
    expect(formatRentalPeriod(daily, 'fr', jours)).toBe('15\u201316 nov. · 2 jours');
    expect(formatRentalPeriod(daily, 'en', days)).not.toMatch(/PM|AM|2026/);
  });

  it('treats a same-clock end the next day as one booked day', () => {
    const overnight = [{
      start_at: '2026-11-12T08:00:00.000Z',
      end_at: '2026-11-13T08:00:00.000Z',
    }];
    expect(formatRentalPeriod(overnight, 'en', days)).toBe('12 Nov · 1 day');
    expect(formatRentalPeriod(overnight, 'fr', jours)).toBe('12 nov. · 1 jour');
    expect(formatRentalPeriod(overnight, 'en', days)).not.toContain('08:00');
  });

  it('counts whole days through the last booked day when the return is the same clock', () => {
    const span = [{
      start_at: '2026-11-15T08:00:00.000Z',
      end_at: '2026-11-18T08:00:00.000Z',
    }];
    expect(formatRentalPeriod(span, 'en', days)).toBe('15\u201317 Nov · 3 days');
    expect(formatRentalPeriod(span, 'fr', jours)).toBe('15\u201317 nov. · 3 jours');
  });

  it('collapses one all-day calendar date to that day', () => {
    const one = [{
      billing: 'all_day',
      calendar_date: '2026-11-12',
      start_at: '2026-11-12T08:00:00.000Z',
      end_at: '2026-11-13T08:00:00.000Z',
    }];
    expect(formatRentalPeriod(one, 'en', days)).toBe('12 Nov · 1 day');
  });

  it('shows hourly bookings as a listing wall-clock range', () => {
    const hourly = [{
      billing: 'hourly',
      start_at: '2026-11-15T10:00:00.000Z',
      end_at: '2026-11-15T14:00:00.000Z',
    }];
    expect(formatRentalPeriod(hourly, 'en', days)).toBe('15 Nov · 10:00\u201314:00');
  });

  it('formats a return instant as one listing clock', () => {
    const at = (iso: string) => [{ start_at: iso, end_at: iso }];
    expect(formatRentalPeriod(at('2026-11-12T18:00:00.000Z'), 'en', days)).toBe('12 Nov · 18:00');
    expect(formatRentalPeriod(at('2026-11-14T18:00:00.000Z'), 'fr', jours)).toBe('14 nov. · 18:00');
    expect(formatRentalPeriod(at('2026-11-12T18:00:00.000Z'), 'en', days)).not.toMatch(/PM|AM|2026/);
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

describe('formatListingDeadline', () => {
  it('uses the listing wall clock, not a device locale string', () => {
    expect(formatListingDeadline('2026-11-20T10:00:00.000Z', 'en')).toBe('Fri 20 Nov, 10:00');
    expect(formatListingDeadline('2026-11-20T10:00:00.000Z', 'fr')).toBe('ven. 20 nov., 10:00');
    expect(formatListingDeadline('2026-11-20T10:00:00.000Z', 'en')).not.toMatch(/AM|PM|2026/);
  });
});

describe('formatListingDue', () => {
  it('keeps a late return on the stored listing day', () => {
    expect(formatListingDue('2026-11-12T09:00:00.000Z', 'en')).toBe('12\u00A0Nov\u00A0·\u00A009:00');
    expect(formatListingDue('2026-11-12T23:30:00.000Z', 'en')).toBe('12\u00A0Nov\u00A0·\u00A023:30');
    expect(formatListingDue('2026-11-14T18:00:00.000Z', 'fr')).toBe('14\u00A0nov.\u00A0·\u00A018:00');
    expect(formatListingDue('2026-11-12T09:00:00.000Z', 'en')).not.toContain('10:00');
    expect(formatListingDue('2026-11-12', 'en')).toBe('2026-11-12');
    expect(formatListingDue('not-a-date', 'en')).toBe('not-a-date');
  });
});

describe('formatRentalPeriod edges', () => {
  const daily = [
    { billing: 'all_day', calendar_date: '2026-11-15', start_at: '2026-11-15T00:00:00.000Z', end_at: '2026-11-16T00:00:00.000Z' },
    { billing: 'all_day', calendar_date: '2026-11-16', start_at: '2026-11-16T00:00:00.000Z', end_at: '2026-11-17T00:00:00.000Z' },
  ];

  it('keeps both months when the stay crosses a month and falls back to clocks for a mixed stay', () => {
    const cross = [
      { billing: 'all_day', calendar_date: '2026-11-30', start_at: '2026-11-30T00:00:00.000Z', end_at: '2026-12-01T00:00:00.000Z' },
      { billing: 'all_day', calendar_date: '2026-12-01', start_at: '2026-12-01T00:00:00.000Z', end_at: '2026-12-02T00:00:00.000Z' },
    ];
    expect(formatRentalPeriod(cross, 'en', days)).toBe('30 Nov \u2013 1 Dec · 2 days');
    expect(formatRentalPeriod(cross, 'fr', jours)).toBe('30 nov. \u2013 1 déc. · 2 jours');
    expect(formatRentalPeriod([], 'en', days)).toBe('\u2014');

    const mixed = [
      { billing: 'all_day', calendar_date: '2026-11-15', start_at: '2026-11-15T10:00:00.000Z', end_at: '2026-11-15T18:00:00.000Z' },
      { billing: 'hourly', start_at: '2026-11-16T09:00:00.000Z', end_at: '2026-11-16T11:00:00.000Z' },
    ];
    expect(formatRentalPeriod(mixed, 'en', days)).toBe('15 Nov · 10:00\u201318:00, 16 Nov · 09:00\u201311:00');
  });

  it('lists quantity and notes, and keeps the old month when the new dates are in another month', () => {
    expect(
      formatChangeDetail(
        { fields: ['quantity', 'notes'], quantity: { from: 1, to: 3 } },
        'en'
      )
    ).toBe('quantity 1 → 3, notes');
    expect(formatChangeDetail(null, 'en')).toBe('');
    expect(formatChangeDetail({ fields: [] }, 'en')).toBe('');
    expect(
      formatChangeDetail(
        {
          fields: ['dates'],
          dates: {
            from: [daily[0]],
            to: [{ billing: 'all_day', calendar_date: '2026-12-01', start_at: '2026-12-01T00:00:00.000Z', end_at: '2026-12-02T00:00:00.000Z' }],
          },
        },
        'en'
      )
    ).toBe('dates 15 Nov → 1 Dec');
    expect(formatRentalDateRange([daily[0]], 'en')).toBe('15 Nov');
  });
});

describe('rental edit confirmation', () => {
  const now = Date.parse('2026-11-12T10:00:00.000Z');

  it('closes the edit at exactly 2 hours and for an unusable start', () => {
    expect(rentalEditWindowOpen(new Date(now + RENTAL_EDIT_LEAD_MS).toISOString(), now)).toBe(false);
    expect(rentalEditWindowOpen(new Date(now + RENTAL_EDIT_LEAD_MS + 1).toISOString(), now)).toBe(true);
    expect(rentalEditWindowOpen('not-a-date', now)).toBe(false);
    expect(rentalEditWindowOpen('', now)).toBe(false);
  });

  it('asks for confirmation only when the new total is higher by more than one centime', () => {
    expect(modifySaveNeedsConfirm(10, 10)).toBe(false);
    expect(modifySaveNeedsConfirm(10.009, 10)).toBe(false);
    expect(modifySaveNeedsConfirm(10.01, 10)).toBe(true);
    expect(modifySaveNeedsConfirm(9, 10)).toBe(false);
    expect(modifySaveNeedsConfirm(Number.NaN, 10)).toBe(false);
  });

  it('treats reordered windows and trimmed notes as the same draft', () => {
    const day = { billing: 'all_day', calendarDate: '2026-11-15', startMs: 1, endMs: 2 };
    const hour = { billing: 'hourly', startMs: 3, endMs: 4 };
    expect(rentalSelectionFingerprint([hour, day], 2, '  hello ')).toBe(
      rentalSelectionFingerprint([day, hour], 2, 'hello')
    );
    expect(rentalSelectionFingerprint([day], 1, 'hello')).not.toBe(rentalSelectionFingerprint([day], 2, 'hello'));
    expect(rentalSelectionFingerprint([day], 1, '   ')).toBe(rentalSelectionFingerprint([day], 1, ''));
  });
});

const bookedDay = (date: string) => ({
  billing: 'all_day' as const,
  calendar_date: date,
  start_at: `${date}T08:00:00.000Z`,
  end_at: `${date}T18:00:00.000Z`,
});

const bookedHour = (start: string, end: string) => ({
  billing: 'hourly' as const,
  start_at: start,
  end_at: end,
});

describe('clientRequestPeriodLines', () => {
  it('shows a single day once, in English and French, with no times and no number', () => {
    const lines = clientRequestPeriodLines([bookedDay('2026-11-12')], 'en', days);
    expect(lines).toEqual(['12 Nov · 1 day']);
    expect(clientRequestPeriodLines([bookedDay('2026-11-12')], 'fr', jours)).toEqual(['12 nov. · 1 jour']);
    expect(lines.join(' ')).not.toMatch(/^1\.|08:00|18:00/);
    expect(isSingleRequestedPeriod([bookedDay('2026-11-12')])).toBe(true);
  });

  it('shows a contiguous stay once, including a cross-month stay', () => {
    const stay = [bookedDay('2026-11-12'), bookedDay('2026-11-13'), bookedDay('2026-11-14')];
    expect(clientRequestPeriodLines(stay, 'en', days)).toEqual(['12\u201314 Nov · 3 days']);
    expect(clientRequestPeriodLines(stay, 'fr', jours)).toEqual(['12\u201314 nov. · 3 jours']);
    const cross = [bookedDay('2026-11-30'), bookedDay('2026-12-01'), bookedDay('2026-12-02')];
    expect(clientRequestPeriodLines(cross, 'en', days)).toEqual(['30 Nov \u2013 2 Dec · 3 days']);
    expect(clientRequestPeriodLines(cross, 'fr', jours)).toEqual(['30 nov. \u2013 2 d\u00e9c. · 3 jours']);
  });

  it('shows one hourly window with listing wall-clock times and no number', () => {
    const slot = [bookedHour('2026-11-12T09:00:00.000Z', '2026-11-12T13:00:00.000Z')];
    expect(LISTING_TIME_ZONE).toBe('Africa/Douala');
    expect(clientRequestPeriodLines(slot, 'en', days)).toEqual(['12 Nov · 09:00\u201313:00']);
    expect(clientRequestPeriodLines(slot, 'fr', jours)).toEqual(['12 nov. · 09:00\u201313:00']);
    expect(clientRequestPeriodLines(slot, 'en', days)[0]).not.toMatch(/04:00|10:00|AM|PM/);
  });

  it('numbers only when there are two or more separate windows', () => {
    const slots = [
      bookedHour('2026-11-12T09:00:00.000Z', '2026-11-12T13:00:00.000Z'),
      bookedHour('2026-11-14T15:00:00.000Z', '2026-11-14T18:00:00.000Z'),
    ];
    expect(isSingleRequestedPeriod(slots)).toBe(false);
    expect(clientRequestPeriodLines(slots, 'en', days)).toEqual([
      '1. 12 Nov · 09:00\u201313:00',
      '2. 14 Nov · 15:00\u201318:00',
    ]);
    expect(clientRequestPeriodLines(slots, 'fr', jours)).toEqual([
      '1. 12 nov. · 09:00\u201313:00',
      '2. 14 nov. · 15:00\u201318:00',
    ]);
    const gaps = [bookedDay('2026-11-12'), bookedDay('2026-11-20')];
    expect(clientRequestPeriodLines(gaps, 'en', days)).toEqual(['1. 12 Nov · 1 day', '2. 20 Nov · 1 day']);
    expect(clientRequestPeriodLines([], 'en', days)).toEqual([]);
  });
});

describe('bookingRequestedPeriodLines', () => {
  it('shows one booking span once instead of repeating it as line 1', () => {
    const span = { start_at: '2026-11-12T08:00:00.000Z', end_at: '2026-11-13T08:00:00.000Z' };
    expect(bookingPeriodWindows([], span)).toEqual([
      { start_at: span.start_at, end_at: span.end_at },
    ]);
    expect(bookingRequestedPeriodLines([], span, 'en', days)).toEqual(['12 Nov · 1 day']);
    expect(bookingRequestedPeriodLines([], span, 'fr', jours)).toEqual(['12 nov. · 1 jour']);
  });

  it('keeps selection windows and does not add the overall span', () => {
    const windows = [bookedDay('2026-11-12'), bookedDay('2026-11-13'), bookedDay('2026-11-14')];
    const span = { start_at: '2026-11-12T08:00:00.000Z', end_at: '2026-11-15T08:00:00.000Z' };
    expect(bookingPeriodWindows(windows, span)).toBe(windows);
    expect(bookingRequestedPeriodLines(windows, span, 'en', days)).toEqual(['12\u201314 Nov · 3 days']);
  });

  it('returns nothing when the booking has neither windows nor a span', () => {
    expect(bookingPeriodWindows([], null)).toEqual([]);
    expect(bookingRequestedPeriodLines([], { start_at: '', end_at: '' }, 'en', days)).toEqual([]);
  });
});
