/**
 * Date-and-time window for the rentals browse search. The day-and-hours picker is the only
 * rental date picker, so the search reads its picked days as one window: the first day's
 * start to the last day's end, in listing wall-clock time. Whole-day edges carry no time.
 */
import {
  addDaysKey,
  keyToUtcMs,
  utcMsToKey,
  type DayHoursListing,
  type PickedDay,
} from './rentalDayHoursPicker';
import { dayLabel, hourLabel, pickerLang, type PickerLang } from './rentalDayHoursCopy';
import { formatExclusiveStay, formatExclusiveStayRange } from './rentalRequestFormat';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const MAX_SEARCH_DAYS = 30;
const CLOCK = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `endDate` is exclusive. Times are HH:mm on the first and last day; none means a whole day. */
export interface SearchStay {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
}

/** A listing open every hour of every day: the picker then shows the whole calendar. */
export const ANY_TIME_LISTING: DayHoursListing = {
  weekly: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    is_available: true,
    start_time: '00:00',
    end_time: '24:00',
  })),
  booked: [],
  units: 1,
  offersDaily: true,
  offersHourly: true,
  minHours: 1,
  maxHours: null,
  dayRate: 0,
  hourRate: 0,
};

function clockMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function clockText(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function stayDayCount(stay: Pick<SearchStay, 'startDate' | 'endDate'>): number {
  return Math.round((keyToUtcMs(stay.endDate) - keyToUtcMs(stay.startDate)) / DAY_MS);
}

export function isTimedStay(stay: Pick<SearchStay, 'startTime' | 'endTime'>): boolean {
  return Boolean(stay.startTime || stay.endTime);
}

export function stayTimes(stay: SearchStay): Pick<SearchStay, 'startTime' | 'endTime'> {
  return {
    ...(stay.startTime ? { startTime: stay.startTime } : {}),
    ...(stay.endTime ? { endTime: stay.endTime } : {}),
  };
}

/** A search link's window, or null when a part is malformed or the stay is not 1 to 30 days. */
export function stayFromParams(start?: string | null, end?: string | null, startTime?: string | null, endTime?: string | null): SearchStay | null {
  if (!start || !end || !DATE.test(start) || !DATE.test(end)) return null;
  if ((startTime && !CLOCK.test(startTime)) || (endTime && !CLOCK.test(endTime)) || startTime === '24:00') return null;
  const stay: SearchStay = { startDate: start, endDate: end, ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}) };
  const days = stayDayCount(stay);
  if (!(days >= 1 && days <= MAX_SEARCH_DAYS)) return null;
  const sameDay = days === 1 && clockMinutes(startTime ?? '00:00') >= clockMinutes(endTime ?? '24:00');
  return sameDay ? null : stay;
}

/** The window between two wall-clock instants. Whole days carry no times. */
export function stayFromWallMs(startMs: number, endMs: number): SearchStay | null {
  if (!(endMs > startMs)) return null;
  const startDate = utcMsToKey(startMs);
  const lastDay = utcMsToKey(endMs - 1);
  const startMinutes = Math.round((startMs - keyToUtcMs(startDate)) / 60_000);
  const endMinutes = Math.round((endMs - keyToUtcMs(lastDay)) / 60_000);
  return {
    startDate,
    endDate: addDaysKey(lastDay, 1),
    ...(startMinutes > 0 ? { startTime: clockText(startMinutes) } : {}),
    ...(endMinutes < 1440 ? { endTime: clockText(endMinutes) } : {}),
  };
}

/** Days picked in the dialog to one window. Days between the first and last count as whole days. */
export function stayFromPickedDays(days: PickedDay[]): SearchStay | null {
  if (!days.length) return null;
  const sorted = [...days].sort((a, b) => a.key.localeCompare(b.key));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startMs = keyToUtcMs(first.key) + (first.mode === 'full' ? 0 : first.start * HOUR_MS);
  const endMs = keyToUtcMs(last.key) + (last.mode === 'full' ? DAY_MS : last.end * HOUR_MS);
  return stayFromWallMs(startMs, endMs);
}

/** The window back as picked days, so the dialog reopens as the renter left it. */
export function pickedDaysFromStay(stay: SearchStay): PickedDay[] {
  const count = stayDayCount(stay);
  const startHour = Math.floor(clockMinutes(stay.startTime ?? '00:00') / 60);
  const endHour = Math.ceil(clockMinutes(stay.endTime ?? '24:00') / 60);
  return Array.from({ length: count }, (_, index) => {
    const start = index === 0 ? startHour : 0;
    const end = index === count - 1 ? endHour : 24;
    return { key: addDaysKey(stay.startDate, index), mode: start === 0 && end === 24 ? 'full' : 'hours', start, end };
  });
}

const FROM_UNTIL: Record<PickerLang, { from: string; until: string }> = {
  en: { from: 'from', until: 'until' },
  fr: { from: 'dès', until: "jusqu'à" },
};

/** "Sat 28 Nov, 09:00 – Sun 29 Nov". Whole-day edges show no time. */
export function formatStayWindow(stay: SearchStay, locale: string): string {
  if (!isTimedStay(stay)) return formatExclusiveStayRange(stay.startDate, stay.endDate, locale);
  const lang = pickerLang(locale);
  const last = addDaysKey(stay.endDate, -1);
  const startMin = clockMinutes(stay.startTime ?? '00:00');
  const endMin = clockMinutes(stay.endTime ?? '24:00');
  const at = (minutes: number) => hourLabel(Math.floor(minutes / 60), lang, undefined, minutes % 60);
  if (stay.startDate !== last) {
    const from = `${dayLabel(stay.startDate, lang)}${startMin > 0 ? `, ${at(startMin)}` : ''}`;
    const to = `${dayLabel(last, lang)}${endMin < 1440 ? `, ${at(endMin)}` : ''}`;
    return `${from} – ${to}`;
  }
  const words = FROM_UNTIL[lang];
  const day = dayLabel(stay.startDate, lang);
  if (startMin > 0 && endMin < 1440) return `${day}, ${at(startMin)} – ${at(endMin)}`;
  return startMin > 0 ? `${day}, ${words.from} ${at(startMin)}` : `${day}, ${words.until} ${at(endMin)}`;
}

/** The Dates row: a timed window already says how long it is, whole days add the day count. */
export function formatStayLine(stay: SearchStay, locale: string, dayCountLabel: (count: number) => string): string {
  if (isTimedStay(stay)) return formatStayWindow(stay, locale);
  return formatExclusiveStay(stay.startDate, stay.endDate, locale, dayCountLabel);
}
