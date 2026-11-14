import { DateTime } from 'luxon';
import {
  blocksMarketRentalDay,
  formatMarketNow,
  marketCalendarDate,
  relativeDayRange,
  resolveMonthDay,
  validateExclusiveRange,
} from './assistant-rental-dates';

const ZONE = 'Africa/Douala';
/** 13 Nov 2026, 16:00 in Douala (UTC+1). */
const AFTERNOON = new Date('2026-11-13T15:00:00.000Z');
/** 14 Nov 2026, 00:30 in Douala — the next local morning. */
const NEXT_MORNING = new Date('2026-11-13T23:30:00.000Z');

describe('rental dates in Africa/Douala', () => {
  it('puts today on the Douala calendar, including the next-morning rollover', () => {
    expect(marketCalendarDate(AFTERNOON, ZONE)).toBe('2026-11-13');
    expect(marketCalendarDate(NEXT_MORNING, ZONE)).toBe('2026-11-14');
    expect(formatMarketNow(AFTERNOON, ZONE)).toContain('Africa/Douala');
    expect(relativeDayRange('tomorrow', AFTERNOON, ZONE).startDate).toBe('2026-11-14');
    expect(relativeDayRange('tomorrow', NEXT_MORNING, ZONE)).toEqual({
      startDate: '2026-11-15',
      endDate: '2026-11-16',
      dayCount: 1,
    });
  });

  it('treats this weekend as Saturday to Monday when today is Friday', () => {
    expect(relativeDayRange('weekend', AFTERNOON, ZONE)).toEqual({
      startDate: '2026-11-14',
      endDate: '2026-11-16',
      dayCount: 2,
    });
  });

  it('rejects a past start, an end before the start, and a range over 30 days', () => {
    const today = '2026-11-13';
    expect(validateExclusiveRange('2026-10-17', '2026-10-18', today).dateIssue).toBe('past');
    const swapped = validateExclusiveRange('2026-11-20', '2026-11-17', today);
    expect(swapped.dateIssue).toBe('end_before_start');
    expect(swapped.suggestion).toMatchObject({ startDate: '2026-11-17', endDate: '2026-11-20', dayCount: 3 });
    const long = validateExclusiveRange('2026-11-17', '2027-02-17', today);
    expect(long.dateIssue).toBe('too_long');
    expect(long.suggestion?.dayCount).toBe(30);
    expect(validateExclusiveRange('2026-11-17', '2026-11-18', today)).toMatchObject({
      status: 'ok',
      dayCount: 1,
    });
  });

  it('treats a month-day more than 60 days ahead as past', () => {
    expect(resolveMonthDay(11, 3, '2026-11-13')).toEqual({ date: '2027-11-03', past: true });
    expect(resolveMonthDay(11, 17, '2026-11-13').past).toBe(false);
  });

  it('does not let a booking that ends at 00:30 Douala block the next day', () => {
    const end = DateTime.fromISO('2026-11-18T00:30:00', { zone: ZONE }).toISO()!;
    const start = DateTime.fromISO('2026-11-17T08:00:00', { zone: ZONE }).toISO()!;
    expect(blocksMarketRentalDay({ startIso: start, endIso: end, day: '2026-11-18', zone: ZONE })).toBe(false);
    expect(blocksMarketRentalDay({ startIso: start, endIso: end, day: '2026-11-17', zone: ZONE })).toBe(true);
  });
});
