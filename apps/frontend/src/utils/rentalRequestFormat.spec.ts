import fs from 'fs';
import path from 'path';
import {
  LISTING_TIME_ZONE,
  bookingPeriodWindows,
  bookingRequestedPeriodLines,
  clientRequestPeriodLines,
  formatRentalDateRange,
  formatRentalPeriod,
  isSingleRequestedPeriod,
  type PeriodWindow,
} from './rentalRequestFormat';

const days = (count: number) => (count === 1 ? '1 day' : `${count} days`);
const jours = (count: number) => (count === 1 ? '1 jour' : `${count} jours`);

const daily = (date: string): PeriodWindow => ({
  billing: 'all_day',
  calendar_date: date,
  start_at: `${date}T08:00:00.000Z`,
  end_at: `${date}T18:00:00.000Z`,
});

const hourly = (start: string, end: string): PeriodWindow => ({
  billing: 'hourly',
  start_at: start,
  end_at: end,
});

describe('formatRentalPeriod', () => {
  const stay = [daily('2026-11-15'), daily('2026-11-16')];

  it('shows a daily range in the listing calendar, not a device clock', () => {
    expect(formatRentalPeriod(stay, 'en', days)).toBe('15\u201316 Nov · 2 days');
    expect(formatRentalPeriod(stay, 'fr', jours)).toBe('15\u201316 nov. · 2 jours');
    expect(formatRentalPeriod(stay, 'en', days)).not.toMatch(/PM|AM|2026|08:00|18:00/);
  });

  it('treats a same-clock end the next day as one booked day and hides the times', () => {
    const overnight = [hourly('2026-11-12T08:00:00.000Z', '2026-11-13T08:00:00.000Z')];
    expect(formatRentalPeriod(overnight, 'en', days)).toBe('12 Nov · 1 day');
    expect(formatRentalPeriod(overnight, 'fr', jours)).toBe('12 nov. · 1 jour');
    expect(formatRentalPeriod(overnight, 'en', days)).not.toContain('08:00');
  });

  it('counts whole days through the last booked day when the return is the same clock', () => {
    const span = [hourly('2026-11-15T08:00:00.000Z', '2026-11-18T08:00:00.000Z')];
    expect(formatRentalPeriod(span, 'en', days)).toBe('15\u201317 Nov · 3 days');
    expect(formatRentalPeriod(span, 'fr', jours)).toBe('15\u201317 nov. · 3 jours');
  });

  it('collapses one all-day calendar date to that day', () => {
    expect(formatRentalPeriod([daily('2026-11-12')], 'en', days)).toBe('12 Nov · 1 day');
    expect(formatRentalPeriod([daily('2026-11-12')], 'fr', jours)).toBe('12 nov. · 1 jour');
  });

  it('shows hourly bookings as a listing wall-clock range', () => {
    const slot = [hourly('2026-11-12T09:00:00.000Z', '2026-11-12T13:00:00.000Z')];
    expect(formatRentalPeriod(slot, 'en', days)).toBe('12 Nov · 09:00\u201313:00');
    expect(formatRentalPeriod(slot, 'fr', jours)).toBe('12 nov. · 09:00\u201313:00');
  });

  it('keeps both months when the stay crosses a month', () => {
    const cross = [daily('2026-11-30'), daily('2026-12-01'), daily('2026-12-02')];
    expect(formatRentalPeriod(cross, 'en', days)).toBe('30 Nov \u2013 2 Dec · 3 days');
    expect(formatRentalPeriod(cross, 'fr', jours)).toBe('30 nov. \u2013 2 d\u00e9c. · 3 jours');
    expect(formatRentalPeriod([], 'en', days)).toBe('\u2014');
    expect(formatRentalDateRange([daily('2026-11-15')], 'en')).toBe('15 Nov');
  });
});

describe('Douala listing clock', () => {
  const slot = [hourly('2026-11-12T09:00:00.000Z', '2026-11-12T13:00:00.000Z')];

  it('uses the stored Africa/Douala wall clock, not the browser zone', () => {
    expect(LISTING_TIME_ZONE).toBe('Africa/Douala');
    expect(formatRentalPeriod(slot, 'en', days)).toBe('12 Nov · 09:00\u201313:00');

    const newYork = clockIn('America/New_York', slot[0].start_at);
    const shiftedDouala = clockIn(LISTING_TIME_ZONE, slot[0].start_at);
    expect(newYork).toBe('04:00');
    expect(shiftedDouala).toBe('10:00');
    expect(formatRentalPeriod(slot, 'en', days)).not.toContain('04:00');
    expect(formatRentalPeriod(slot, 'en', days)).not.toContain('10:00');
  });

  it('formats a return instant as one listing clock', () => {
    const at = (iso: string): PeriodWindow[] => [{ start_at: iso, end_at: iso }];
    expect(formatRentalPeriod(at('2026-11-12T18:00:00.000Z'), 'en', days)).toBe('12 Nov · 18:00');
    expect(formatRentalPeriod(at('2026-11-14T18:00:00.000Z'), 'fr', jours)).toBe('14 nov. · 18:00');
    expect(formatRentalPeriod(at('2026-11-12T18:00:00.000Z'), 'en', days)).not.toMatch(/PM|AM|2026/);
  });

  it('does not roll a late listing clock onto the next calendar day', () => {
    const late = [hourly('2026-11-12T23:30:00.000Z', '2026-11-12T23:45:00.000Z')];
    expect(formatRentalPeriod(late, 'en', days)).toBe('12 Nov · 23:30\u201323:45');
    const doualaDay = new Intl.DateTimeFormat('en-GB', {
      timeZone: LISTING_TIME_ZONE,
      day: 'numeric',
    }).format(new Date(late[0].start_at));
    expect(doualaDay).toBe('13');
  });
});

describe('clientRequestPeriodLines', () => {
  it('shows a single daily period once, with no numbered line and no times', () => {
    const lines = clientRequestPeriodLines([daily('2026-11-12')], 'en', days);
    expect(lines).toEqual(['12 Nov · 1 day']);
    expect(lines.join(' ')).not.toMatch(/^1\.|08:00|18:00/);
    expect(isSingleRequestedPeriod([daily('2026-11-12')])).toBe(true);
  });

  it('shows a contiguous daily stay once, in English and French', () => {
    const stay = [daily('2026-11-12'), daily('2026-11-13'), daily('2026-11-14')];
    expect(clientRequestPeriodLines(stay, 'en', days)).toEqual(['12\u201314 Nov · 3 days']);
    expect(clientRequestPeriodLines(stay, 'fr', jours)).toEqual(['12\u201314 nov. · 3 jours']);
    expect(clientRequestPeriodLines(stay, 'en', days)[0]).not.toMatch(/08:00|1\./);
  });

  it('shows one hourly period with times and no numbered line', () => {
    const slot = [hourly('2026-11-12T09:00:00.000Z', '2026-11-12T13:00:00.000Z')];
    expect(clientRequestPeriodLines(slot, 'en', days)).toEqual(['12 Nov · 09:00\u201313:00']);
    expect(clientRequestPeriodLines(slot, 'fr', jours)).toEqual(['12 nov. · 09:00\u201313:00']);
  });

  it('numbers separate hourly periods and keeps their times', () => {
    const slots = [
      hourly('2026-11-12T09:00:00.000Z', '2026-11-12T13:00:00.000Z'),
      hourly('2026-11-14T15:00:00.000Z', '2026-11-14T18:00:00.000Z'),
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
  });

  it('numbers gapped daily periods instead of implying one continuous stay', () => {
    const gaps = [daily('2026-11-12'), daily('2026-11-20')];
    expect(clientRequestPeriodLines(gaps, 'en', days)).toEqual([
      '1. 12 Nov · 1 day',
      '2. 20 Nov · 1 day',
    ]);
    expect(clientRequestPeriodLines(gaps, 'en', days).join(' ')).not.toContain('08:00');
  });

  it('returns nothing when the request has no windows', () => {
    expect(clientRequestPeriodLines([], 'en', days)).toEqual([]);
  });
});

describe('bookingRequestedPeriodLines', () => {
  it('shows one booking span once instead of repeating it as line 1', () => {
    const span = { start_at: '2026-11-12T08:00:00.000Z', end_at: '2026-11-13T08:00:00.000Z' };
    expect(bookingPeriodWindows([], span)).toEqual([{ start_at: span.start_at, end_at: span.end_at }]);
    expect(bookingRequestedPeriodLines([], span, 'en', days)).toEqual(['12 Nov · 1 day']);
    expect(bookingRequestedPeriodLines([], span, 'fr', jours)).toEqual(['12 nov. · 1 jour']);
  });

  it('keeps separate windows numbered and does not add the overall span', () => {
    const slots = [
      hourly('2026-11-12T09:00:00.000Z', '2026-11-12T13:00:00.000Z'),
      hourly('2026-11-14T15:00:00.000Z', '2026-11-14T18:00:00.000Z'),
    ];
    const span = { start_at: slots[0].start_at, end_at: slots[1].end_at };
    expect(bookingPeriodWindows(slots, span)).toBe(slots);
    expect(bookingRequestedPeriodLines(slots, span, 'en', days)).toEqual([
      '1. 12 Nov · 09:00\u201313:00',
      '2. 14 Nov · 15:00\u201318:00',
    ]);
    expect(bookingRequestedPeriodLines(slots, span, 'fr', jours)).toEqual([
      '1. 12 nov. · 09:00\u201313:00',
      '2. 14 nov. · 15:00\u201318:00',
    ]);
  });

  it('returns nothing when the booking has neither windows nor a span', () => {
    expect(bookingPeriodWindows([], null)).toEqual([]);
    expect(bookingRequestedPeriodLines([], { start_at: null, end_at: null }, 'en', days)).toEqual([]);
  });
});

describe('period day count copy', () => {
  it('has English and French plural keys', () => {
    const en = readLocale('en');
    const fr = readLocale('fr');
    expect(en.rentals.clientRequests.periodDayCount_one).toBe('{{count}} day');
    expect(en.rentals.clientRequests.periodDayCount_other).toBe('{{count}} days');
    expect(fr.rentals.clientRequests.periodDayCount_one).toBe('{{count}} jour');
    expect(fr.rentals.clientRequests.periodDayCount_other).toBe('{{count}} jours');
  });
});

function clockIn(timeZone: string, iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function readLocale(language: 'en' | 'fr'): {
  rentals: { clientRequests: Record<string, string> };
} {
  const file = path.resolve(__dirname, '../../public/locales', `${language}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
