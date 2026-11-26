import {
  bookedRange,
  dayFieldLabel,
  parseTimeField,
  returnDayChoices,
  timeFieldText,
  bookedUntil,
  canReturnEarly,
  earlyReportPending,
  fieldsToInstantIso,
  freedWindow,
  instantClock,
  isBeforeDue,
  listingFields,
  returnAtProblem,
  returnedEarly,
  unusedDays,
  type EarlyReturnBooking,
} from './earlyReturn';
import { renterReturnPhase } from './renterReturnPhase';

const NB = '\u00a0';
const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';

// Toronto: booked 2:00 PM – 6:00 PM on the listing clock (wall clock with a Z suffix).
const toronto: EarlyReturnBooking = {
  status: 'active',
  start_at: '2026-11-26T14:00:00Z',
  end_at: '2026-11-26T18:00:00Z',
  actual_start_at: '2026-11-26T19:05:00.000Z', // 2:05 PM EST
};
const torontoNow = Date.parse('2026-11-26T20:40:00.000Z'); // 3:40 PM EST

// Douala: booked 14:00 – 18:00 WAT (UTC+1); due instant is 17:00Z.
const douala: EarlyReturnBooking = {
  status: 'active',
  start_at: '2026-11-26T14:00:00Z',
  end_at: '2026-11-26T18:00:00Z',
  actual_start_at: '2026-11-26T13:05:00.000Z',
};

describe('isBeforeDue (listing clock)', () => {
  it('Toronto: 5:30 PM EST is early, 6:30 PM is not', () => {
    expect(isBeforeDue('2026-11-26T22:30:00.000Z', toronto, TORONTO)).toBe(true);
    expect(isBeforeDue('2026-11-26T23:30:00.000Z', toronto, TORONTO)).toBe(false);
  });

  it('Douala: 17:30 WAT is early, 18:30 WAT is not (no naive UTC compare)', () => {
    expect(isBeforeDue('2026-11-26T16:30:00.000Z', douala, DOUALA)).toBe(true);
    expect(isBeforeDue('2026-11-26T17:30:00.000Z', douala, DOUALA)).toBe(false);
  });

  it('uses return_due_at when set (early-start hourly booking)', () => {
    const b = { ...toronto, return_due_at: '2026-11-26T17:00:00Z' };
    expect(isBeforeDue('2026-11-26T22:30:00.000Z', b, TORONTO)).toBe(false);
  });
});

describe('canReturnEarly (AC1)', () => {
  const base = { booking: toronto, timeZone: TORONTO, flagOn: true, now: torontoNow };
  it('shows for an active, started, not-due rental with the flag on', () => {
    expect(canReturnEarly(base)).toBe(true);
  });
  it('hides when the flag is off, a not-received report exists, or already reported', () => {
    expect(canReturnEarly({ ...base, flagOn: false })).toBe(false);
    expect(canReturnEarly({ ...base, notReceived: true })).toBe(false);
    expect(canReturnEarly({ ...base, booking: { ...toronto, renter_reported_returned_at: '2026-11-26T20:00:00Z' } })).toBe(false);
  });
  it('hides before pickup, when not active, and once due', () => {
    expect(canReturnEarly({ ...base, booking: { ...toronto, actual_start_at: null } })).toBe(false);
    expect(canReturnEarly({ ...base, booking: { ...toronto, status: 'confirmed' } })).toBe(false);
    expect(canReturnEarly({ ...base, now: Date.parse('2026-11-26T23:00:00.000Z') })).toBe(false);
  });
});

describe('early states', () => {
  it('pending until the business confirms, then returned early', () => {
    const reported = { ...toronto, renter_reported_returned_at: '2026-11-26T20:40:00.000Z' };
    expect(earlyReportPending(reported, TORONTO)).toBe(true);
    const done = { ...reported, status: 'completed', actual_end_at: '2026-11-26T20:40:00.000Z' };
    expect(earlyReportPending(done, TORONTO)).toBe(false);
    expect(returnedEarly(done, TORONTO)).toBe(true);
    expect(returnedEarly({ ...done, actual_end_at: '2026-11-26T23:30:00.000Z' }, TORONTO)).toBe(false);
  });

  it('the renter return card shows Waiting for an early report before due', () => {
    expect(
      renterReturnPhase({
        status: 'active',
        endAt: '2026-11-26T18:00:00Z',
        reportedAt: '2026-11-26T20:40:00.000Z',
        timeZone: TORONTO,
        now: new Date(torontoNow),
      })
    ).toBe('waiting');
    expect(renterReturnPhase({ status: 'active', endAt: '2026-11-26T18:00:00Z', timeZone: TORONTO, now: new Date(torontoNow) })).toBe('hidden');
  });
});

describe('copy formatting', () => {
  it('12 h for English Americas, 24 h for French and Douala', () => {
    expect(instantClock(torontoNow, 'en', TORONTO)).toBe(`3:40${NB}PM`);
    expect(instantClock(torontoNow, 'fr', TORONTO)).toBe('15:40');
    expect(instantClock('2026-11-26T14:40:00.000Z', 'en', DOUALA)).toBe('15:40');
  });

  it('same-day range and freed window', () => {
    expect(bookedRange(toronto, 'en', TORONTO)).toBe(`2:00${NB}PM – 6:00${NB}PM`);
    expect(bookedUntil(toronto, 'fr', TORONTO)).toBe('18:00');
    expect(freedWindow(toronto, torontoNow, 'en', TORONTO)).toBe(`3:40${NB}PM – 6:00${NB}PM`);
  });

  it('multi-day range and unused-day chips', () => {
    const multi = { ...toronto, end_at: '2026-11-28T18:00:00Z' };
    expect(bookedRange(multi, 'en', TORONTO)).toBe(`Thu${NB}26 – Sat${NB}28${NB}Nov`);
    expect(bookedRange(multi, 'fr', TORONTO)).toBe(`jeu.${NB}26 – sam.${NB}28${NB}nov.`);
    expect(unusedDays(multi, torontoNow, 'en', TORONTO)).toEqual([`Fri${NB}27`, `Sat${NB}28`]);
    expect(unusedDays(toronto, torontoNow, 'en', TORONTO)).toEqual([]);
  });
});

describe('corrected return time (listing clock)', () => {
  it('round-trips date/time fields in Toronto and Douala', () => {
    expect(fieldsToInstantIso('2026-11-26', '15:40', TORONTO)).toBe('2026-11-26T20:40:00.000Z');
    expect(fieldsToInstantIso('2026-11-26', '15:40', DOUALA)).toBe('2026-11-26T14:40:00.000Z');
    expect(listingFields(torontoNow, TORONTO)).toEqual({ date: '2026-11-26', time: '15:40' });
    expect(fieldsToInstantIso('2026-02-30', '10:00', TORONTO)).toBeNull();
    expect(fieldsToInstantIso('2026-11-26', '25:00', TORONTO)).toBeNull();
  });

  it('rejects times before pickup or in the future', () => {
    expect(returnAtProblem(null, toronto, torontoNow)).toBe('invalid');
    expect(returnAtProblem('2026-11-26T19:00:00.000Z', toronto, torontoNow)).toBe('beforePickup');
    expect(returnAtProblem('2026-11-26T21:00:00.000Z', toronto, torontoNow)).toBe('future');
    expect(returnAtProblem('2026-11-26T20:30:00.000Z', toronto, torontoNow)).toBeNull();
  });
});

describe('edit-time fields in the listing format (S2)', () => {
  it('labels days and times like the listing', () => {
    expect(dayFieldLabel('2026-11-26', 'en', TORONTO)).toBe('Thu, Nov 26');
    expect(dayFieldLabel('2026-11-26', 'fr', TORONTO)).toBe(`jeu.${NB}26${NB}nov.`);
    expect(dayFieldLabel('2026-11-26', 'en', DOUALA)).toBe(`Thu${NB}26${NB}Nov`);
    expect(timeFieldText('15:40', 'en', TORONTO)).toBe('3:40 PM');
    expect(timeFieldText('15:40', 'fr', TORONTO)).toBe('15:40');
  });

  it('parses 12 h and 24 h input', () => {
    expect(parseTimeField('3:40 PM')).toBe('15:40');
    expect(parseTimeField('12:05 am')).toBe('00:05');
    expect(parseTimeField('15h40')).toBe('15:40');
    expect(parseTimeField('13:00 PM')).toBeNull();
    expect(parseTimeField('3pm')).toBeNull();
  });

  it('offers pickup day to today on the listing clock', () => {
    const started = { ...toronto, actual_start_at: '2026-11-24T19:05:00.000Z' };
    expect(returnDayChoices(started, torontoNow, TORONTO)).toEqual(['2026-11-26', '2026-11-25', '2026-11-24']);
    expect(returnDayChoices(toronto, torontoNow, TORONTO)).toEqual(['2026-11-26']);
  });
});
