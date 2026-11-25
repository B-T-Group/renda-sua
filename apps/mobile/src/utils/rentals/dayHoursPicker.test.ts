import { describe, expect, it } from 'vitest';
import {
  canRemoveDay,
  dayInfo,
  daysInARow,
  defaultBlock,
  listingNowMs,
  monthGrid,
  sharedCells,
  tapHour,
  toApiWindows,
  toggleDay,
  totalPrice,
  type DayHoursListing,
  type DayInfo,
  type PickedDay,
} from './dayHoursPicker';
import {
  dayLabel,
  footerDetail,
  fromHourlyPrice,
  pickerText,
  submitRuleText,
  lockReason,
  pickerMoney,
  rangeLabel,
  serverRuleCode,
  serverRuleText,
  sharedLockReason,
  summaryLine,
} from './dayHoursCopy';

const WEEKLY = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  is_available: weekday !== 0,
  start_time: weekday !== 0 ? '08:00:00' : null,
  end_time: weekday !== 0 ? '18:00:00' : null,
}));

function listing(over: Partial<DayHoursListing> = {}): DayHoursListing {
  return {
    weekly: WEEKLY,
    booked: [{ startAt: '2026-11-28T13:00:00.000Z', endAt: '2026-11-28T16:00:00.000Z', unitsBooked: 1 }],
    units: 1,
    offersDaily: true,
    offersHourly: true,
    minHours: 2,
    maxHours: null,
    dayRate: 27000,
    hourRate: 3000,
    ...over,
  };
}

// Wed 25 Nov 2026, 10:20 at the listing.
const NOW = Date.UTC(2026, 10, 25, 10, 20);

describe('day-hours picker model', () => {
  it('marks past, closed, partly booked and free days', () => {
    const l = listing();
    expect(dayInfo('2026-11-24', l, NOW).status).toBe('past');
    expect(dayInfo('2026-11-29', l, NOW).status).toBe('closed');
    expect(dayInfo('2026-11-28', l, NOW).status).toBe('partial');
    expect(dayInfo('2026-11-27', l, NOW).status).toBe('free');
  });

  it('locks Full day on a partly booked day and on today once open', () => {
    const l = listing();
    const sat = dayInfo('2026-11-28', l, NOW);
    expect(sat.fullDayLock).toBe('booked');
    expect(sat.bookedRun).toEqual({ from: 13, to: 16 });
    const today = dayInfo('2026-11-25', l, NOW);
    expect(today.fullDayLock).toBe('today');
    expect(today.fromHour).toBe(13);
    expect(today.cells.filter((c) => c.state === 'past').map((c) => c.hour)).toEqual([8, 9, 10, 11, 12]);
  });

  it('daily-only listings make partly booked days unavailable', () => {
    const l = listing({ offersHourly: false });
    expect(dayInfo('2026-11-28', l, NOW).status).toBe('unavailable');
    expect(dayInfo('2026-11-25', l, NOW).status).toBe('past');
  });

  it('defaults a new day to Full day, or the first free 2 h block', () => {
    const l = listing();
    const added = toggleDay([], dayInfo('2026-11-27', l, NOW), l);
    expect(added).toMatchObject({ kind: 'added', days: [{ key: '2026-11-27', mode: 'full' }] });
    const sat = toggleDay([], dayInfo('2026-11-28', l, NOW), l);
    expect(sat).toMatchObject({ kind: 'added', days: [{ key: '2026-11-28', mode: 'hours', start: 8, end: 10 }] });
    const today = toggleDay([], dayInfo('2026-11-25', l, NOW), l);
    expect(today).toMatchObject({ kind: 'added', days: [{ mode: 'hours', start: 13, end: 15 }] });
  });

  it('uses the listing minimum when it is above 2 h', () => {
    const info = dayInfo('2026-11-27', listing({ minHours: 4 }), NOW);
    expect(defaultBlock(info.cells, 4, null)).toEqual({ start: 8, end: 12 });
  });

  it('only allows days in a row; a closed Sunday may sit between', () => {
    expect(daysInARow(['2026-11-27', '2026-11-28', '2026-11-30'], WEEKLY)).toBe(true);
    expect(daysInARow(['2026-11-27', '2026-11-30'], WEEKLY)).toBe(false);
    const l = listing();
    const fri: PickedDay[] = [{ key: '2026-11-27', mode: 'full', start: 8, end: 10 }];
    expect(toggleDay(fri, dayInfo('2026-11-30', l, NOW), l).kind).toBe('notInARow');
    const three: PickedDay[] = [
      ...fri,
      { key: '2026-11-28', mode: 'hours', start: 10, end: 13 },
      { key: '2026-11-30', mode: 'hours', start: 14, end: 17 },
    ];
    expect(toggleDay(three, dayInfo('2026-11-28', l, NOW), l).kind).toBe('notInARow');
    expect(toggleDay(three, dayInfo('2026-11-30', l, NOW), l).kind).toBe('removed');
  });

  it('taps a start then an end, stretches to the minimum and stops at a booking', () => {
    const l = listing();
    const sat = dayInfo('2026-11-28', l, NOW);
    const day: PickedDay = { key: '2026-11-28', mode: 'hours', start: 8, end: 10 };
    const first = tapHour(day, 10, false, sat.cells, 2, null);
    expect(first.day).toMatchObject({ start: 10, end: 12 });
    expect(first.awaitingEnd).toBe(true);
    const second = tapHour(first.day, 10, true, sat.cells, 2, null);
    expect(second.day).toMatchObject({ start: 10, end: 12 });
    expect(second.note).toMatchObject({ kind: 'stretched', hour: 12 });
    const tooFar = tapHour(first.day, 16, true, sat.cells, 1, null);
    expect(tooFar.day).toMatchObject({ start: 10, end: 13 });
    expect(tapHour(day, 14, false, sat.cells, 2, null).day).toEqual(day);
  });

  it('caps a block at the maximum', () => {
    const fri = dayInfo('2026-11-27', listing(), NOW);
    const r = tapHour({ key: '2026-11-27', mode: 'hours', start: 8, end: 10 }, 17, true, fri.cells, 2, 4);
    expect(r.day).toMatchObject({ start: 8, end: 12 });
    expect(r.note).toMatchObject({ kind: 'capped' });
  });

  it('greys an hour booked on any picked day for Same for all days', () => {
    const l = listing();
    const cells = sharedCells([dayInfo('2026-11-27', l, NOW), dayInfo('2026-11-28', l, NOW)]);
    expect(cells.filter((c) => c.state === 'booked').map((c) => c.hour)).toEqual([13, 14, 15]);
  });

  it('maps rows to windows[] and totals like the server snapshot', () => {
    const l = listing();
    const days: PickedDay[] = [
      { key: '2026-11-27', mode: 'full', start: 8, end: 10 },
      { key: '2026-11-28', mode: 'hours', start: 10, end: 13 },
      { key: '2026-11-30', mode: 'hours', start: 14, end: 17 },
    ];
    const infos: Record<string, DayInfo> = Object.fromEntries(days.map((d) => [d.key, dayInfo(d.key, l, NOW)]));
    expect(toApiWindows(days, infos)).toEqual([
      { requestedStartAt: '2026-11-27T08:00:00.000Z', requestedEndAt: '2026-11-27T18:00:00.000Z', billing: 'all_day', calendarDate: '2026-11-27' },
      { requestedStartAt: '2026-11-28T10:00:00.000Z', requestedEndAt: '2026-11-28T13:00:00.000Z', billing: 'hourly' },
      { requestedStartAt: '2026-11-30T14:00:00.000Z', requestedEndAt: '2026-11-30T17:00:00.000Z', billing: 'hourly' },
    ]);
    expect(totalPrice(days, l)).toBe(45000);
    expect(summaryLine(days, 'en')).toBe('3 days · 1 full, 2\u00A0×\u00A03\u00A0h');
    expect(summaryLine(days, 'fr')).toBe('3 jours · 1 journée, 2\u00A0×\u00A03\u00A0h');
    expect(footerDetail(days, infos, 'en', 'Africa/Libreville')).toBe('Pickup Fri\u00A027\u00A0Nov, 08:00');
    expect(footerDetail(days, infos, 'fr', 'Africa/Libreville')).toBe('Retrait ven.\u00A027\u00A0nov., 08:00');
  });

  it('formats money with NBSP and times per market', () => {
    expect(pickerMoney(45000, 'XAF', 'en')).toBe('45\u00A0000\u00A0FCFA');
    expect(pickerMoney(88, 'CAD', 'en')).toBe('$88.00');
    expect(pickerMoney(88, 'CAD', 'fr')).toBe('88,00\u00A0$');
    expect(rangeLabel(10, 13, 'en', 'America/Toronto')).toBe('10 AM – 1 PM');
    expect(rangeLabel(14, 17, 'en', 'America/Toronto')).toBe('2 PM – 5 PM');
    expect(rangeLabel(8, 10, 'en', 'Africa/Libreville')).toBe('08:00 – 10:00');
    expect(dayLabel('2026-11-27', 'en')).toBe('Fri\u00A027\u00A0Nov');
    expect(dayLabel('2026-11-30', 'fr')).toBe('lun.\u00A030\u00A0nov.');
    expect(fromHourlyPrice(3000, 'XAF', 'en')).toBe('from\u00A03\u00A0000\u00A0FCFA / h');
    expect(fromHourlyPrice(3000, 'XAF', 'fr')).toBe('dès\u00A03\u00A0000\u00A0FCFA / h');
    expect(pickerText('fr', 'todayFrom', { time: '09:00' })).toBe('Aujourd’hui · dès\u00A009:00');
    expect(serverRuleText('RENTAL_LEAD_TIME', 'fr')).toBe('Ce début est maintenant dans moins de 2\u00A0h. Choisissez une heure plus tard.');
    expect(serverRuleText('SOMETHING_ELSE', 'en')).toBeNull();
    expect(serverRuleCode({ response: { data: { code: 'RENTAL_LEAD_TIME' } } })).toBe('RENTAL_LEAD_TIME');
    const refused = { response: { status: 400, data: { code: 'RENTAL_LEAD_TIME' } } };
    expect(submitRuleText(refused, true, 'fr-FR')).toBe('Ce début est maintenant dans moins de 2\u00A0h. Choisissez une heure plus tard.');
    expect(submitRuleText(refused, false, 'en')).toBeNull();
    expect(submitRuleText(new Error('network'), true, 'en')).toBeNull();
  });

  it('builds Sunday-first and Monday-first grids and reads listing time', () => {
    expect(monthGrid(2026, 10, 0).slice(0, 1)).toEqual(['2026-11-01']);
    expect(monthGrid(2026, 10, 1).indexOf('2026-11-01')).toBe(6);
    expect(new Date(listingNowMs(Date.UTC(2026, 10, 25, 9, 20), 'Africa/Libreville')).toISOString()).toBe(
      '2026-11-25T10:20:00.000Z'
    );
  });

  it('gives a reason for every Full day lock and only lets the ends be removed', () => {
    const l = listing();
    const today = dayInfo('2026-11-25', l, NOW);
    expect(lockReason(today, 'en')).toBe('Full day isn’t possible today: it has already started.');
    const early = dayInfo('2026-11-25', l, Date.UTC(2026, 10, 25, 7, 0));
    expect(early.fullDayLock).toBe('today');
    expect(lockReason(early, 'fr')).toBe('Journée impossible aujourd’hui\u00A0: elle commence dans moins de 2\u00A0h.');
    const sat = dayInfo('2026-11-28', l, NOW);
    expect(sharedLockReason([dayInfo('2026-11-27', l, NOW), sat], 'en')).toBe('Full day isn’t possible: Sat\u00A028\u00A0Nov is partly booked.');
    const days = ['2026-11-27', '2026-11-28', '2026-11-30', '2026-12-01'].map((key) => ({ key, mode: 'full' as const, start: 8, end: 18 }));
    expect(days.map((d) => canRemoveDay(days, d.key))).toEqual([true, false, false, true]);
    expect(canRemoveDay(days.slice(0, 2), '2026-11-28')).toBe(true);
  });
});
