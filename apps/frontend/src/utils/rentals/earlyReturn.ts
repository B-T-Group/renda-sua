import { listingNowMs } from '../rentalDayHoursPicker';

/**
 * Early return (Samuel, 26 Nov): end an active rental before it is due. The renter
 * still pays the full price. Copied from apps/mobile/src/utils/rentals/earlyReturn.ts; keep both in sync.
 *
 * start_at / end_at / return_due_at are the listing wall clock written as UTC
 * components (Toronto 6:00 PM is `T18:00:00Z`). actual_start_at, actual_end_at and
 * renter_reported_returned_at are real instants. "Early" compares real instants.
 */

const DAY_MS = 86_400_000;
const NBSP = '\u00a0';

export interface EarlyReturnBooking {
  status: string;
  start_at?: string | null;
  end_at?: string | null;
  return_due_at?: string | null;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  renter_reported_returned_at?: string | null;
}

/** Real instant when the listing clock shows `wallMs` (same rule as the server's wallClockToInstantMs). */
export function wallToInstantMs(wallMs: number, timeZone?: string | null): number {
  if (!Number.isFinite(wallMs)) return Number.NaN;
  const offsetAt = (instant: number) => listingNowMs(instant, timeZone) - instant;
  const before = wallMs - offsetAt(wallMs - DAY_MS);
  const after = wallMs - offsetAt(wallMs + DAY_MS);
  const hits = [before, after].filter((instant) => listingNowMs(instant, timeZone) === wallMs);
  return hits.length ? Math.max(...hits) : before;
}

/** Stored due (wall clock): the hourly early-start due when set, else the booked end. */
export function dueWallIso(booking: EarlyReturnBooking): string | null {
  return booking.return_due_at || booking.end_at || null;
}

export function dueInstantMs(booking: EarlyReturnBooking, timeZone?: string | null): number {
  const due = dueWallIso(booking);
  return due ? wallToInstantMs(Date.parse(due), timeZone) : Number.NaN;
}

/** True when a real instant is strictly before the due on the listing clock. */
export function isBeforeDue(instantIso: string | null | undefined, booking: EarlyReturnBooking, timeZone?: string | null): boolean {
  const at = instantIso ? Date.parse(instantIso) : Number.NaN;
  const due = dueInstantMs(booking, timeZone);
  return Number.isFinite(at) && Number.isFinite(due) && at < due;
}

export interface CanReturnEarlyInput {
  booking: EarlyReturnBooking;
  timeZone?: string | null;
  /** rentals_renter_return_report_enabled */
  flagOn: boolean;
  /** A "didn't receive the item" report exists. */
  notReceived?: boolean;
  now?: number;
}

/** AC1: active, started, not overdue, flag on, no not-received report, not already reported. */
export function canReturnEarly(input: CanReturnEarlyInput): boolean {
  const { booking } = input;
  if (!input.flagOn || input.notReceived) return false;
  if (booking.status !== 'active' || booking.renter_reported_returned_at) return false;
  const now = input.now ?? Date.now();
  const started = booking.actual_start_at ? Date.parse(booking.actual_start_at) : Number.NaN;
  if (!Number.isFinite(started) || started > now) return false;
  const due = dueInstantMs(booking, input.timeZone);
  return Number.isFinite(due) && now < due;
}

/** The return instant: the confirmed end, else the renter's report. */
export function returnInstantIso(booking: EarlyReturnBooking): string | null {
  return booking.actual_end_at || booking.renter_reported_returned_at || null;
}

/** AC10: "Returned early" only when the return instant is before the due instant. */
export function returnedEarly(booking: EarlyReturnBooking, timeZone?: string | null): boolean {
  if (!['active', 'awaiting_return', 'completed'].includes(booking.status)) return false;
  return isBeforeDue(returnInstantIso(booking), booking, timeZone);
}

/** Renter reported early and the business has not confirmed yet. */
export function earlyReportPending(booking: EarlyReturnBooking, timeZone?: string | null): boolean {
  return (
    (booking.status === 'active' || booking.status === 'awaiting_return') &&
    isBeforeDue(booking.renter_reported_returned_at, booking, timeZone)
  );
}

function french(language?: string | null): boolean {
  return (language || '').toLowerCase().startsWith('fr');
}

/** 12 h only for English on Americas listings ("3:40 PM"), 24 h elsewhere ("15:40"). */
export function uses12hClock(language?: string | null, timeZone?: string | null): boolean {
  return !french(language) && (timeZone || '').startsWith('America/');
}

function clockFromWallMs(wallMs: number, language?: string | null, timeZone?: string | null): string {
  if (!Number.isFinite(wallMs)) return '';
  const d = new Date(wallMs);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  if (!uses12hClock(language, timeZone)) return `${String(h).padStart(2, '0')}:${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m}${NBSP}${h < 12 ? 'AM' : 'PM'}`;
}

/** A real instant (report, actual end, now) as a time on the listing clock. */
export function instantClock(iso: string | number | null | undefined, language?: string | null, timeZone?: string | null): string {
  const ms = typeof iso === 'number' ? iso : iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ms) ? clockFromWallMs(listingNowMs(ms, timeZone), language, timeZone) : '';
}

/** A stored wall-clock ISO (start_at, end_at) as a time, with no zone shift. */
export function wallClock(iso: string | null | undefined, language?: string | null, timeZone?: string | null): string {
  return clockFromWallMs(iso ? Date.parse(iso) : Number.NaN, language, timeZone);
}

const EN_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FR_WD = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FR_MON = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function dayKey(wallMs: number): string {
  return new Date(wallMs).toISOString().slice(0, 10);
}

function weekday(wallMs: number, language?: string | null): string {
  const d = new Date(wallMs).getUTCDay();
  return french(language) ? FR_WD[d] : EN_WD[d];
}

/** "Thu 26" / "jeu. 26" */
function shortDay(wallMs: number, language?: string | null): string {
  return `${weekday(wallMs, language)}${NBSP}${new Date(wallMs).getUTCDate()}`;
}

/** "Fri 27" chips for the unused days. */
function chipDay(wallMs: number, language?: string | null): string {
  return shortDay(wallMs, language);
}

function month(wallMs: number, language?: string | null): string {
  const m = new Date(wallMs).getUTCMonth();
  return french(language) ? FR_MON[m] : EN_MON[m];
}

/** Last booked wall-clock day (an end at 00:00 belongs to the day before). */
function lastBookedDayMs(endWallMs: number): number {
  const midnight = Date.UTC(new Date(endWallMs).getUTCFullYear(), new Date(endWallMs).getUTCMonth(), new Date(endWallMs).getUTCDate());
  return midnight === endWallMs ? midnight - DAY_MS : midnight;
}

export function isMultiDay(booking: EarlyReturnBooking): boolean {
  const start = Date.parse(booking.start_at || '');
  const end = Date.parse(dueWallIso(booking) || '');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return dayKey(start) !== dayKey(lastBookedDayMs(end));
}

/** Booked range: "2:00 PM – 6:00 PM" same day, "Thu 26 – Sat 28 Nov" across days. */
export function bookedRange(booking: EarlyReturnBooking, language?: string | null, timeZone?: string | null): string {
  const start = Date.parse(booking.start_at || '');
  const endIso = dueWallIso(booking);
  const end = Date.parse(endIso || '');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '';
  if (!isMultiDay(booking)) return `${wallClock(booking.start_at, language, timeZone)} – ${wallClock(endIso, language, timeZone)}`;
  const last = lastBookedDayMs(end);
  return `${shortDay(start, language)} – ${shortDay(last, language)}${NBSP}${month(last, language)}`;
}

/** "Booked until 6:00 PM" value: time same day, "Sat 28 · 6:00 PM" across days. */
export function bookedUntil(booking: EarlyReturnBooking, language?: string | null, timeZone?: string | null): string {
  const endIso = dueWallIso(booking);
  const end = Date.parse(endIso || '');
  if (!Number.isFinite(end)) return '';
  const time = wallClock(endIso, language, timeZone);
  return isMultiDay(booking) ? `${shortDay(end, language)} · ${time}` : time;
}

/** "Returning now" value: "3:40 PM", or "Thu 26 · 3:40 PM" on a multi-day booking. */
export function returningNow(booking: EarlyReturnBooking, nowMs: number, language?: string | null, timeZone?: string | null): string {
  const time = instantClock(nowMs, language, timeZone);
  return isMultiDay(booking) ? `${shortDay(listingNowMs(nowMs, timeZone), language)} · ${time}` : time;
}

/** Whole booked days after today on the listing clock, as chips ("Fri 27", "Sat 28"). No refund for them. */
export function unusedDays(booking: EarlyReturnBooking, nowMs: number, language?: string | null, timeZone?: string | null): string[] {
  const end = Date.parse(dueWallIso(booking) || '');
  if (!Number.isFinite(end) || !isMultiDay(booking)) return [];
  const today = Date.parse(`${dayKey(listingNowMs(nowMs, timeZone))}T00:00:00Z`);
  const days: string[] = [];
  for (let day = today + DAY_MS; day <= lastBookedDayMs(end); day += DAY_MS) days.push(chipDay(day, language));
  return days;
}

/** "3:40 PM – 6:00 PM" window that opens for new bookings once the return is confirmed. */
export function freedWindow(booking: EarlyReturnBooking, returnedIso: string | number | null | undefined, language?: string | null, timeZone?: string | null): string {
  const from = instantClock(returnedIso, language, timeZone);
  const to = bookedUntil(booking, language, timeZone);
  return from && to ? `${from} – ${to}` : '';
}

/** Listing-clock date + time fields ("2026-11-26", "15:40") for a real instant. */
export function listingFields(instantMs: number, timeZone?: string | null): { date: string; time: string } {
  const iso = new Date(listingNowMs(instantMs, timeZone)).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Typed listing-clock date + time ("2026-11-26", "15:40") as a real-instant ISO; null when invalid. */
export function fieldsToInstantIso(date: string, time: string, timeZone?: string | null): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [y, mo, day, h, mi] = [Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])];
  if (h > 23 || mi > 59) return null;
  const wall = Date.UTC(y, mo, day, h, mi);
  const back = new Date(wall);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo || back.getUTCDate() !== day) return null;
  const ms = wallToInstantMs(wall, timeZone);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export type ReturnAtProblem = 'invalid' | 'beforePickup' | 'future' | null;

/** D6: the corrected return time can't be before pickup or after now. */
export function returnAtProblem(iso: string | null, booking: EarlyReturnBooking, nowMs = Date.now()): ReturnAtProblem {
  const at = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(at)) return 'invalid';
  const started = booking.actual_start_at ? Date.parse(booking.actual_start_at) : Number.NaN;
  if (Number.isFinite(started) && at < started) return 'beforePickup';
  if (at > nowMs + 60_000) return 'future';
  return null;
}

const US_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Listing-format day label for a "YYYY-MM-DD" key: "Thu, Nov 26" (EN Americas), "Thu 26 Nov", "jeu. 26 nov.". */
export function dayFieldLabel(dateKey: string, language?: string | null, timeZone?: string | null): string {
  const ms = Date.parse(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(ms)) return dateKey;
  const d = new Date(ms);
  if (uses12hClock(language, timeZone)) return `${US_WD[d.getUTCDay()]}, ${EN_MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return `${weekday(ms, language)}${NBSP}${d.getUTCDate()}${NBSP}${month(ms, language)}`;
}

/** Days the return can fall on (pickup day → today, listing clock), newest first, at most `max`. */
export function returnDayChoices(booking: EarlyReturnBooking, nowMs: number, timeZone?: string | null, max = 7): string[] {
  const today = Date.parse(`${dayKey(listingNowMs(nowMs, timeZone))}T00:00:00Z`);
  const started = booking.actual_start_at ? Date.parse(booking.actual_start_at) : Number.NaN;
  const first = Number.isFinite(started) ? Date.parse(`${dayKey(listingNowMs(started, timeZone))}T00:00:00Z`) : today;
  const days: string[] = [];
  for (let day = today; day >= first && days.length < max; day -= DAY_MS) days.push(dayKey(day));
  return days;
}

/** "15:40" shown in the listing format: "3:40 PM" (EN Americas) or "15:40". */
export function timeFieldText(time24: string, language?: string | null, timeZone?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time24);
  if (!m) return time24;
  return clockFromWallMs(Date.UTC(2026, 0, 1, Number(m[1]), Number(m[2])), language, timeZone).replace(NBSP, ' ');
}

/** Parse a typed time ("3:40 PM", "3:40pm", "15:40", "15h40") to "HH:mm"; null when invalid. */
export function parseTimeField(text: string): string | null {
  const m = /^\s*(\d{1,2})\s*[:h.]\s*(\d{2})\s*([ap]\.?\s*m\.?)?\s*$/i.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const ap = m[3]?.toLowerCase().startsWith('p') ? 'pm' : m[3] ? 'am' : null;
  if (mi > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ap === 'pm' ? 12 : 0);
  } else if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/**
 * True when a 12-hour listing (EN Americas) gets a bare "3:40" with no AM/PM.
 * Hours 1–12 are ambiguous there, so the field asks for AM or PM instead of
 * silently reading it as 03:40. 24-hour listings and "0:xx"/"13:xx"+ are not ambiguous.
 */
export function timeFieldNeedsMeridiem(text: string, language?: string | null, timeZone?: string | null): boolean {
  if (!uses12hClock(language, timeZone)) return false;
  const m = /^\s*(\d{1,2})\s*[:h.]\s*(\d{2})\s*$/i.exec(text);
  if (!m) return false;
  const h = Number(m[1]);
  return h >= 1 && h <= 12;
}
