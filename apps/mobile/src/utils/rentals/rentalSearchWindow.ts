/**
 * Date-and-time search window. The day-and-hours picker is the only rental date picker,
 * so the browse search reads its picked days and turns them into one window: the first
 * day's start to the last day's end, in listing wall-clock time.
 */
import {
  DAY_HOURS_LEAD_MS,
  addDaysKey,
  keyToUtcMs,
  listingNowMs,
  utcMsToKey,
  weekdayOfKey,
  type DayHoursListing,
  type PickedDay,
} from './dayHoursPicker';
import { hourLabel, dayLabel, pickerLang, type PickerLang } from './dayHoursCopy';
import {
  eachDateKey,
  formatSearchStay,
  formatSearchStayRange,
  type RentalDateRange,
} from './rentalSearchDates';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEKEND_START_HOUR = 9;
const NEXT_DAY_START_HOUR = 8;
const LATEST_START_HOUR = 22;

/** A listing open every hour of every day: the picker then shows the whole calendar. */
export const ANY_TIME_LISTING: DayHoursListing = {
  weekly: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, is_available: true, start_time: '00:00', end_time: '24:00' })),
  booked: [],
  units: 1,
  offersDaily: true,
  offersHourly: true,
  minHours: 1,
  maxHours: null,
  dayRate: 0,
  hourRate: 0,
};

export function isTimedRange(range: Pick<RentalDateRange, 'startTime' | 'endTime'>): boolean {
  return Boolean(range.startTime || range.endTime);
}

function clockMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function clockText(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** The window between two wall-clock instants. Whole days carry no times. */
export function rangeFromWallMs(startMs: number, endMs: number): RentalDateRange | null {
  if (!(endMs > startMs)) return null;
  const startDate = utcMsToKey(startMs);
  const lastDay = utcMsToKey(endMs - 1);
  const endDate = addDaysKey(lastDay, 1);
  const startMinutes = Math.round((startMs - keyToUtcMs(startDate)) / 60_000);
  const endMinutes = Math.round((endMs - keyToUtcMs(lastDay)) / 60_000);
  return {
    startDate,
    endDate,
    dayCount: Math.round((keyToUtcMs(endDate) - keyToUtcMs(startDate)) / DAY_MS),
    ...(startMinutes > 0 ? { startTime: clockText(startMinutes) } : {}),
    ...(endMinutes < 1440 ? { endTime: clockText(endMinutes) } : {}),
  };
}

/** Days picked in the sheet to one window. Days between the first and last count as whole days. */
export function rangeFromPickedDays(days: PickedDay[]): RentalDateRange | null {
  if (!days.length) return null;
  const sorted = [...days].sort((a, b) => a.key.localeCompare(b.key));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startMs = keyToUtcMs(first.key) + (first.mode === 'full' ? 0 : first.start * HOUR_MS);
  const endMs = keyToUtcMs(last.key) + (last.mode === 'full' ? DAY_MS : last.end * HOUR_MS);
  return rangeFromWallMs(startMs, endMs);
}

/** The window back as picked days, so the sheet reopens as the renter left it. */
export function pickedDaysFromRange(range: RentalDateRange): PickedDay[] {
  const keys = eachDateKey(range);
  const startHour = Math.floor(clockMinutes(range.startTime ?? '00:00') / 60);
  const endHour = Math.ceil(clockMinutes(range.endTime ?? '24:00') / 60);
  return keys.map((key, index) => {
    const start = index === 0 ? startHour : 0;
    const end = index === keys.length - 1 ? endHour : 24;
    return { key, mode: start === 0 && end === 24 ? 'full' : 'hours', start, end };
  });
}

/** First whole hour a renter can start: now plus the booking lead, rounded up. */
function earliestStartMs(nowMs: number, timeZone?: string | null): number {
  const wall = listingNowMs(nowMs, timeZone) + DAY_HOURS_LEAD_MS;
  return Math.ceil(wall / HOUR_MS) * HOUR_MS;
}

function dayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

function tomorrowMorning(nowMs: number, timeZone?: string | null): number {
  return dayStart(listingNowMs(nowMs, timeZone)) + DAY_MS + NEXT_DAY_START_HOUR * HOUR_MS;
}

/** Earliest bookable hour today; late in the evening it moves to tomorrow morning. */
function todayStartMs(nowMs: number, timeZone?: string | null): number {
  const earliest = earliestStartMs(nowMs, timeZone);
  const today = dayStart(listingNowMs(nowMs, timeZone));
  const sameDay = dayStart(earliest) === today;
  if (sameDay && (earliest - today) / HOUR_MS <= LATEST_START_HOUR) return earliest;
  return tomorrowMorning(nowMs, timeZone);
}

/** Earliest bookable hour today until the end of the day. */
export function todayWindow(nowMs = Date.now(), timeZone?: string | null): RentalDateRange {
  const start = todayStartMs(nowMs, timeZone);
  return rangeFromWallMs(start, dayStart(start) + DAY_MS)!;
}

/** Saturday 09:00 to the end of Sunday. During the weekend it starts at the earliest bookable hour. */
export function weekendWindow(nowMs = Date.now(), timeZone?: string | null): RentalDateRange {
  const earliest = earliestStartMs(nowMs, timeZone);
  const today = dayStart(listingNowMs(nowMs, timeZone));
  const weekday = weekdayOfKey(utcMsToKey(today));
  let saturday = weekday === 0 ? today - DAY_MS : today + ((6 - weekday + 7) % 7) * DAY_MS;
  let start = Math.max(saturday + WEEKEND_START_HOUR * HOUR_MS, earliest);
  if (start >= saturday + 2 * DAY_MS) {
    saturday += 7 * DAY_MS;
    start = saturday + WEEKEND_START_HOUR * HOUR_MS;
  }
  return rangeFromWallMs(start, saturday + 2 * DAY_MS)!;
}

/** Earliest bookable hour today for exactly seven days. */
export function weekWindow(nowMs = Date.now(), timeZone?: string | null): RentalDateRange {
  const start = todayStartMs(nowMs, timeZone);
  return rangeFromWallMs(start, start + 7 * DAY_MS)!;
}

const FROM_UNTIL: Record<PickerLang, { from: string; until: string }> = {
  en: { from: 'from', until: 'until' },
  fr: { from: 'dès', until: "jusqu'à" },
};

/** "Sat 28 Nov, 9 AM – Sun 29 Nov". Whole-day edges show no time. */
export function formatSearchWindow(range: RentalDateRange, locale: string): string {
  if (!isTimedRange(range)) return formatSearchStayRange(range, locale);
  const lang = pickerLang(locale);
  const first = range.startDate;
  const last = addDaysKey(range.endDate, -1);
  const startMin = clockMinutes(range.startTime ?? '00:00');
  const endMin = clockMinutes(range.endTime ?? '24:00');
  const at = (minutes: number) => hourLabel(Math.floor(minutes / 60), lang, undefined, minutes % 60);
  if (first !== last) {
    const from = `${dayLabel(first, lang)}${startMin > 0 ? `, ${at(startMin)}` : ''}`;
    const to = `${dayLabel(last, lang)}${endMin < 1440 ? `, ${at(endMin)}` : ''}`;
    return `${from} – ${to}`;
  }
  const words = FROM_UNTIL[lang];
  if (startMin > 0 && endMin < 1440) return `${dayLabel(first, lang)}, ${at(startMin)} – ${at(endMin)}`;
  if (startMin > 0) return `${dayLabel(first, lang)}, ${words.from} ${at(startMin)}`;
  return `${dayLabel(first, lang)}, ${words.until} ${at(endMin)}`;
}

/** The Dates field line: a timed window already says how long it is, whole days add the day count. */
export function formatSearchWindowLine(
  range: RentalDateRange,
  locale: string,
  dayCountLabel: (count: number) => string
): string {
  return isTimedRange(range) ? formatSearchWindow(range, locale) : formatSearchStay(range, locale, dayCountLabel);
}
