/**
 * Day-and-hours picker model.
 *
 * Everything is listing wall-clock time: a day is a `YYYY-MM-DD` key and an hour is
 * 0..24 on that day. Booked windows from the API are floating wall-clock times
 * encoded with a `Z` (`2026-11-28T13:00:00Z` = 13:00 at the listing), so they are
 * read with UTC getters. Pure functions; the mobile sheet and the web dialog share
 * this file (copied from apps/mobile/src/utils/rentals/dayHoursPicker.ts; keep both in sync).
 */

export const DAY_HOURS_LEAD_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_BLOCK_HOURS = 2;

export type DayMode = 'full' | 'hours';

export interface DayHoursWeeklyRow {
  weekday: number;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

export interface DayHoursBookedWindow {
  startAt: string;
  endAt: string;
  unitsBooked?: number;
}

export interface DayHoursListing {
  weekly: DayHoursWeeklyRow[];
  booked: DayHoursBookedWindow[];
  units: number;
  offersDaily: boolean;
  offersHourly: boolean;
  minHours: number;
  maxHours: number | null;
  dayRate: number;
  hourRate: number;
}

export type CellState = 'free' | 'booked' | 'past';

export interface DayCell {
  hour: number;
  state: CellState;
}

export type DayStatus = 'past' | 'closed' | 'unavailable' | 'partial' | 'free';

export interface DayInfo {
  key: string;
  status: DayStatus;
  isToday: boolean;
  /** Minutes after midnight. */
  openMin: number | null;
  closeMin: number | null;
  cells: DayCell[];
  /** Why Full day can't be picked; null when it can. */
  fullDayLock: null | 'booked' | 'today';
  /** With fullDayLock 'today': true once the day has opened, false when it opens in under the lead time. */
  todayStarted: boolean;
  /** First booked run on the day, for the lock reason. */
  bookedRun: { from: number; to: number } | null;
  /** First hour a block may start today (now + lead, rounded up). */
  fromHour: number | null;
}

export interface PickedDay {
  key: string;
  mode: DayMode;
  start: number;
  end: number;
}

export interface BlockNote {
  kind: 'stretched' | 'capped' | 'tooShort';
  hour: number;
}

const DAY_MS = 86400000;

export function keyToUtcMs(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`);
}

export function utcMsToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  return utcMsToKey(keyToUtcMs(key) + days * DAY_MS);
}

export function weekdayOfKey(key: string): number {
  return new Date(keyToUtcMs(key)).getUTCDay();
}

/** Wall-clock now at the listing, as floating UTC ms. Falls back to device time. */
export function listingNowMs(nowMs: number, timeZone?: string | null): number {
  if (!timeZone) {
    const d = new Date(nowMs);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(nowMs));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  } catch {
    return listingNowMs(nowMs, null);
  }
}

function clockMinutes(raw?: string | null): number | null {
  if (!raw) return null;
  const [h, m] = raw.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function openingFor(key: string, weekly: DayHoursWeeklyRow[]): { openMin: number; closeMin: number } | null {
  const row = weekly.find((w) => Number(w.weekday) === weekdayOfKey(key));
  if (!row?.is_available) return null;
  const openMin = clockMinutes(row.start_time);
  const closeMin = clockMinutes(row.end_time);
  if (openMin == null || closeMin == null || closeMin <= openMin) return null;
  return { openMin, closeMin };
}

function unitsUsed(fromMs: number, toMs: number, booked: DayHoursBookedWindow[]): number {
  const points: Array<{ t: number; d: number }> = [];
  for (const w of booked) {
    const s = Math.max(fromMs, Date.parse(w.startAt));
    const e = Math.min(toMs, Date.parse(w.endAt));
    if (!(e > s)) continue;
    const u = Math.max(1, Number(w.unitsBooked) || 1);
    points.push({ t: s, d: u }, { t: e, d: -u });
  }
  points.sort((a, b) => a.t - b.t || a.d - b.d);
  let cur = 0;
  let peak = 0;
  for (const p of points) {
    cur += p.d;
    peak = Math.max(peak, cur);
  }
  return peak;
}

export function dayInfo(key: string, listing: DayHoursListing, nowWallMs: number): DayInfo {
  const todayKey = utcMsToKey(nowWallMs);
  const isToday = key === todayKey;
  const base: DayInfo = {
    key,
    status: 'closed',
    isToday,
    openMin: null,
    closeMin: null,
    cells: [],
    fullDayLock: null,
    todayStarted: false,
    bookedRun: null,
    fromHour: null,
  };
  if (key < todayKey) return { ...base, status: 'past' };
  const open = openingFor(key, listing.weekly);
  if (!open) return base;
  const dayMs = keyToUtcMs(key);
  const stock = Math.max(1, Math.floor(listing.units) || 1);
  const firstCell = Math.ceil(open.openMin / 60);
  const lastEnd = Math.floor(open.closeMin / 60);
  const earliest = nowWallMs + DAY_HOURS_LEAD_MS;
  const cells: DayCell[] = [];
  let anyBooked = false;
  for (let h = firstCell; h < lastEnd; h += 1) {
    const s = dayMs + h * 3600000;
    const booked = unitsUsed(s, s + 3600000, listing.booked) >= stock;
    if (booked) anyBooked = true;
    const past = s < earliest;
    cells.push({ hour: h, state: past ? 'past' : booked ? 'booked' : 'free' });
  }
  const free = cells.filter((c) => c.state === 'free');
  const bookedRun = firstBookedRun(cells);
  const openMs = dayMs + open.openMin * 60000;
  const todayLocked = openMs < earliest;
  const fullDayLock: DayInfo['fullDayLock'] = anyBooked ? 'booked' : todayLocked ? 'today' : null;
  const fromHour = isToday ? free[0]?.hour ?? null : null;
  let status: DayStatus = free.length === 0 ? (isToday ? 'past' : 'unavailable') : anyBooked ? 'partial' : 'free';
  // Daily-only: a day Full day can't take is not pickable at all.
  if (!listing.offersHourly && fullDayLock) status = fullDayLock === 'today' ? 'past' : 'unavailable';
  return { ...base, status, openMin: open.openMin, closeMin: open.closeMin, cells, fullDayLock, todayStarted: openMs <= nowWallMs, bookedRun, fromHour };
}

function firstBookedRun(cells: DayCell[]): { from: number; to: number } | null {
  const i = cells.findIndex((c) => c.state === 'booked');
  if (i < 0) return null;
  let j = i;
  while (j + 1 < cells.length && cells[j + 1].state === 'booked') j += 1;
  return { from: cells[i].hour, to: cells[j].hour + 1 };
}

export function isPickable(info: DayInfo): boolean {
  return info.status === 'free' || info.status === 'partial';
}

function cellFree(cells: DayCell[], hour: number): boolean {
  return cells.some((c) => c.hour === hour && c.state === 'free');
}

export function blockIsFree(cells: DayCell[], start: number, end: number): boolean {
  if (!(end > start)) return false;
  for (let h = start; h < end; h += 1) if (!cellFree(cells, h)) return false;
  return true;
}

/** Wanted block length: max(2 h, listing minimum), capped by the maximum. */
export function defaultBlockLength(minHours: number, maxHours: number | null): number {
  const want = Math.max(DEFAULT_BLOCK_HOURS, Math.max(1, Math.floor(minHours) || 1));
  return maxHours != null && maxHours > 0 ? Math.min(want, maxHours) : want;
}

/** First free slot of the wanted length, else the first run that meets the minimum. */
export function defaultBlock(cells: DayCell[], minHours: number, maxHours: number | null): { start: number; end: number } | null {
  const len = defaultBlockLength(minHours, maxHours);
  const min = Math.max(1, Math.floor(minHours) || 1);
  for (const c of cells) if (blockIsFree(cells, c.hour, c.hour + len)) return { start: c.hour, end: c.hour + len };
  for (const c of cells) if (blockIsFree(cells, c.hour, c.hour + min)) return { start: c.hour, end: c.hour + min };
  return null;
}

/** A new day row: Full day when offered and possible, else the default hour block. */
export function newPickedDay(info: DayInfo, listing: DayHoursListing): PickedDay | null {
  if (listing.offersDaily && !info.fullDayLock && info.openMin != null && info.closeMin != null) {
    const block = defaultBlock(info.cells, listing.minHours, listing.maxHours);
    return { key: info.key, mode: 'full', start: block?.start ?? Math.ceil(info.openMin / 60), end: block?.end ?? Math.ceil(info.openMin / 60) + 2 };
  }
  if (!listing.offersHourly) return null;
  const block = defaultBlock(info.cells, listing.minHours, listing.maxHours);
  if (!block) return null;
  return { key: info.key, mode: 'hours', ...block };
}

/** The renter tapped a start cell (first tap) or an end cell (second tap). */
export function tapHour(
  day: PickedDay,
  hour: number,
  awaitingEnd: boolean,
  cells: DayCell[],
  minHours: number,
  maxHours: number | null
): { day: PickedDay; awaitingEnd: boolean; note: BlockNote | null } {
  const min = Math.max(1, Math.floor(minHours) || 1);
  if (!cellFree(cells, hour)) return { day, awaitingEnd, note: null };
  if (awaitingEnd && hour >= day.start) {
    let end = hour + 1;
    let note: BlockNote | null = null;
    for (let h = day.start; h < end; h += 1) {
      if (!cellFree(cells, h)) {
        end = h;
        break;
      }
    }
    if (maxHours != null && maxHours > 0 && end - day.start > maxHours) {
      end = day.start + maxHours;
      note = { kind: 'capped', hour: end };
    }
    if (end - day.start < min) {
      if (blockIsFree(cells, day.start, day.start + min)) {
        end = day.start + min;
        note = { kind: 'stretched', hour: end };
      } else {
        return { day, awaitingEnd: false, note: { kind: 'tooShort', hour: day.start } };
      }
    }
    return { day: { ...day, mode: 'hours', end }, awaitingEnd: false, note };
  }
  if (blockIsFree(cells, hour, hour + min)) {
    const note: BlockNote | null = min > 1 ? { kind: 'stretched', hour: hour + min } : null;
    return { day: { ...day, mode: 'hours', start: hour, end: hour + min }, awaitingEnd: true, note };
  }
  return { day, awaitingEnd: false, note: { kind: 'tooShort', hour } };
}

/**
 * Days in a row: every open weekday between the first and last picked day must be
 * picked (closed weekdays may sit between). Mirrors the server rule.
 */
export function daysInARow(keys: string[], weekly: DayHoursWeeklyRow[]): boolean {
  const sorted = [...new Set(keys)].sort();
  if (sorted.length < 2) return true;
  const set = new Set(sorted);
  let cursor = sorted[0];
  const last = sorted[sorted.length - 1];
  let guard = 0;
  while (cursor < last && guard < 400) {
    cursor = addDaysKey(cursor, 1);
    guard += 1;
    if (!set.has(cursor) && openingFor(cursor, weekly)) return false;
  }
  return true;
}

export type ToggleResult =
  | { kind: 'added'; days: PickedDay[] }
  | { kind: 'removed'; days: PickedDay[] }
  | { kind: 'notInARow' }
  | { kind: 'unpickable' };

export function toggleDay(days: PickedDay[], info: DayInfo, listing: DayHoursListing): ToggleResult {
  if (days.some((d) => d.key === info.key)) {
    const next = days.filter((d) => d.key !== info.key);
    if (!daysInARow(next.map((d) => d.key), listing.weekly)) return { kind: 'notInARow' };
    return { kind: 'removed', days: next };
  }
  if (!isPickable(info)) return { kind: 'unpickable' };
  if (!daysInARow([...days.map((d) => d.key), info.key], listing.weekly)) return { kind: 'notInARow' };
  const row = newPickedDay(info, listing);
  if (!row) return { kind: 'unpickable' };
  return { kind: 'added', days: [...days, row].sort((a, b) => a.key.localeCompare(b.key)) };
}

export function blockHours(day: PickedDay): number {
  return Math.max(1, day.end - day.start);
}

export function dayPrice(day: PickedDay, listing: DayHoursListing): number {
  return day.mode === 'full' ? listing.dayRate : blockHours(day) * listing.hourRate;
}

export function totalPrice(days: PickedDay[], listing: DayHoursListing): number {
  return days.reduce((sum, d) => sum + dayPrice(d, listing), 0);
}

/** Combined cells for "Same for all days": an hour is free only if free on every day. */
export function sharedCells(infos: DayInfo[]): DayCell[] {
  if (!infos.length) return [];
  const hours = new Set<number>();
  for (const info of infos) for (const c of info.cells) hours.add(c.hour);
  return [...hours]
    .sort((a, b) => a - b)
    .map((hour) => {
      let state: CellState = 'free';
      for (const info of infos) {
        const c = info.cells.find((x) => x.hour === hour);
        if (!c || c.state === 'booked') {
          state = 'booked';
          break;
        }
        if (c.state === 'past') state = 'past';
      }
      return { hour, state };
    });
}

/** Apply one choice to every day; hour blocks fall back to a block free on all days. */
export function applyToAll(days: PickedDay[], choice: { mode: DayMode; start: number; end: number }): PickedDay[] {
  return days.map((d) => ({ ...d, mode: choice.mode, start: choice.start, end: choice.end }));
}

export interface ApiWindow {
  requestedStartAt: string;
  requestedEndAt: string;
  billing: 'hourly' | 'all_day';
  calendarDate?: string;
}

function iso(key: string, minutes: number): string {
  return new Date(keyToUtcMs(key) + minutes * 60000).toISOString();
}

/** `windows[]` for POST / PATCH /rentals/requests. */
export function toApiWindows(days: PickedDay[], infos: Record<string, DayInfo>): ApiWindow[] {
  return days.map((d) => {
    const info = infos[d.key];
    if (d.mode === 'full' && info?.openMin != null && info.closeMin != null) {
      return { requestedStartAt: iso(d.key, info.openMin), requestedEndAt: iso(d.key, info.closeMin), billing: 'all_day', calendarDate: d.key };
    }
    return { requestedStartAt: iso(d.key, d.start * 60), requestedEndAt: iso(d.key, d.end * 60), billing: 'hourly' };
  });
}

/** Same rows as device-local instants for the existing request review (RentalSlotPicker). */
export function toSelectionRanges(
  days: PickedDay[],
  infos: Record<string, DayInfo>
): Array<{ id: string; startMs: number; endMs: number; billing: 'hourly' | 'all_day'; calendarDate?: string }> {
  return toApiWindows(days, infos).map((w, i) => {
    const local = (value: string) => {
      const d = new Date(value);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()).getTime();
    };
    return {
      id: `dh-${days[i].key}`,
      startMs: local(w.requestedStartAt),
      endMs: local(w.requestedEndAt),
      billing: w.billing,
      ...(w.calendarDate ? { calendarDate: w.calendarDate } : {}),
    };
  });
}

/** Rows coming back from the review (search dates, an edit) become picked days. */
export function fromSelectionRanges(
  rows: Array<{ startMs: number; endMs: number; billing?: string; calendarDate?: string }>,
  listing: DayHoursListing,
  nowWallMs: number
): PickedDay[] {
  const out: PickedDay[] = [];
  for (const r of rows) {
    const s = new Date(r.startMs);
    const e = new Date(r.endMs);
    const key = r.calendarDate ?? utcMsToKey(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()));
    if (out.some((d) => d.key === key)) continue;
    const info = dayInfo(key, listing, nowWallMs);
    if (!isPickable(info)) continue;
    if (r.billing === 'all_day' || r.calendarDate) {
      const row = newPickedDay(info, listing);
      if (row) out.push(row);
      continue;
    }
    const start = s.getHours();
    const end = Math.max(start + 1, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
    out.push(
      listing.offersHourly && blockIsFree(info.cells, start, end)
        ? { key, mode: 'hours', start, end }
        : newPickedDay(info, listing) ?? { key, mode: 'hours', start, end }
    );
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** Month grid of day keys; null pads the first week. `weekStart` 0 = Sunday, 1 = Monday. */
export function monthGrid(year: number, month0: number, weekStart: 0 | 1 = 0): Array<string | null> {
  const first = Date.UTC(year, month0, 1);
  const lead = (new Date(first).getUTCDay() - weekStart + 7) % 7;
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const out: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d += 1) out.push(utcMsToKey(Date.UTC(year, month0, d)));
  return out;
}

/** The Full day | Hours switch shows only when the listing rents both ways. */
/** First and last picked days can be removed; middle ones can't (days stay in a row). */
export function canRemoveDay(days: PickedDay[], key: string): boolean {
  if (days.length < 3) return true;
  const keys = days.map((d) => d.key).sort();
  return key === keys[0] || key === keys[keys.length - 1];
}

export function showModeSwitch(listing: Pick<DayHoursListing, 'offersDaily' | 'offersHourly'>): boolean {
  return listing.offersDaily && listing.offersHourly;
}
