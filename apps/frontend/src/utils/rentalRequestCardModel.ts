import { rentalBillableHours } from '../components/rentals/rentalRequestScheduleUtils';
import { formatRequestAmount } from './rentalRequestDisplay';
import { withRateUnit } from './rentals/moneyRateUnit';
import {
  formatRentalDateRange,
  formatRentalDay as formatRequestDay,
  type PeriodWindow,
} from './rentalRequestFormat';
import type { RentalSelectionWindow } from '../hooks/useRentalApi';
import { isExpiredRentalRequest } from './dashboardRentalRequests';

const DOUALA = 'Africa/Douala';
const EN_DASH = '\u2013';
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

type Copy = (key: string, fallback: string, options?: Record<string, unknown>) => string;

export interface RequestCardSource {
  id: string;
  created_at: string;
  units_requested?: number | null;
  quoted_total?: number | string | null;
  rental_pricing_snapshot?: unknown;
  rental_selection_windows?: RentalSelectionWindow[] | null;
  client_request_note?: string | null;
  change_summary?: {
    fields?: string[];
    dates?: { from: PeriodWindow[]; to: PeriodWindow[] };
    quantity?: { from: number; to: number };
  } | null;
  status?: string | null;
  unavailable_reason_code?: string | null;
  dates_available?: boolean | null;
  payment_rail?: string | null;
  listing_timezone?: string | null;
  rental_location_listing: {
    base_price_per_hour?: number | string | null;
    base_price_per_day?: number | string | null;
    security_deposit_amount?: number | string | null;
    business_location?: {
      name?: string | null;
      address?: { city?: string | null } | null;
    } | null;
    rental_item: { name: string; currency?: string | null };
  };
  client?: {
    user?: { first_name?: string | null; last_name?: string | null } | null;
  } | null;
}

export interface RequestCardSchedule {
  summary: string;
  expandable: boolean;
  lines: string[];
}

export interface RequestCardModel {
  itemName: string;
  quantity: number | null;
  place: string | null;
  updated: boolean;
  changeDetail: string;
  startsIn: { kind: 'today' } | { kind: 'days'; count: number } | null;
  schedule: RequestCardSchedule;
  receiveAmount: string | null;
  receiveLine: string | null;
  breakdown: string | null;
  depositAmount: string | null;
  quoteMissing: boolean;
  renterName: string;
  initials: string;
  note: string | null;
  sentClock: string;
  acceptDisabled: boolean;
  expired: boolean;
}

interface SnapshotLine {
  kind?: string;
  ratePerDay?: number;
  ratePerHour?: number;
  billableHours?: number;
}

interface Snapshot {
  total?: number;
  currency?: string;
  securityDeposit?: number;
  lines?: SnapshotLine[];
}

/** Deposit is quoted on the card only for a card rail. MoMo and wallet never hold one. */
export function shouldShowDepositLine(
  deposit: number,
  rail: string | null | undefined
): boolean {
  if (!(deposit > 0)) return false;
  const normalized = (rail ?? '').trim().toLowerCase();
  return normalized === 'stripe' || normalized === 'card';
}

/** Calendar-day gap from today in the listing timezone. Defaults to Africa/Douala. */
export function startsInCalendarDays(startDateKey: string, now: Date, zone: string = DOUALA): number | null {
  if (!ISO_DATE.test(startDateKey)) return null;
  const today = dateKeyInZone(now, zone);
  const start = Date.parse(`${startDateKey}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(todayMs)) return null;
  return Math.round((start - todayMs) / 86_400_000);
}

export function doualaDateKey(instant: Date): string {
  return dateKeyInZone(instant, DOUALA);
}

function dateKeyInZone(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function sentClock(iso: string, locale: string, zone: string = DOUALA): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const french = locale.toLowerCase().startsWith('fr');
  // FR is zero-padded 24h (`07:00`); EN stays `7:00 AM`.
  return new Intl.DateTimeFormat(french ? 'en-GB' : 'en-US', {
    hour: french ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !french,
    timeZone: zone,
  }).format(date);
}

function zoneOf(request: RequestCardSource): string {
  const zone = request.listing_timezone?.trim();
  return zone || DOUALA;
}

export function renterInitials(first?: string | null, last?: string | null): string {
  const given = (first ?? '').trim();
  const family = (last ?? '').trim();
  if (given && family) {
    if (given.length === 2 && given === given.toLocaleUpperCase()) return given;
    return `${given.charAt(0)}${family.charAt(0)}`.toLocaleUpperCase();
  }
  return (given || family).slice(0, 2).toLocaleUpperCase();
}

export function buildRequestCardModel(
  request: RequestCardSource,
  locale: string,
  now: Date,
  t: Copy
): RequestCardModel {
  const windows = windowsOf(request);
  const total = contractTotal(request);
  const expired = isExpiredRentalRequest(request);
  const money = moneyLines(request, windows, total, locale, t, expired);
  const deposit = depositAmount(request);
  const showDeposit = shouldShowDepositLine(deposit, request.payment_rail);
  const name = renterName(request);
  const zone = zoneOf(request);
  const startKey = listingStartKey(windows);
  const starts = startKey == null ? null : startsInCalendarDays(startKey, now, zone);
  return {
    itemName: request.rental_location_listing.rental_item.name,
    quantity: quantityLabel(request.units_requested),
    place: branchPlace(request),
    updated: (request.change_summary?.fields?.length ?? 0) > 0,
    changeDetail: formatChangeDetail(request.change_summary, locale),
    startsIn: startsInChip(starts),
    schedule: cardSchedule(windows, locale, t),
    receiveAmount: money.amount,
    receiveLine: money.line,
    breakdown: money.breakdown,
    depositAmount: showDeposit ? formatRequestAmount(deposit, currencyOf(request), locale) : null,
    quoteMissing: total == null,
    renterName: name,
    initials: renterInitials(request.client?.user?.first_name, request.client?.user?.last_name),
    note: request.client_request_note?.trim() || null,
    sentClock: sentClock(request.created_at, locale, zone),
    acceptDisabled: request.dates_available === false,
    expired,
  };
}

function startsInChip(days: number | null): RequestCardModel['startsIn'] {
  if (days == null || days < 0) return null;
  if (days === 0) return { kind: 'today' };
  return { kind: 'days', count: days };
}

function quantityLabel(units: number | null | undefined): number | null {
  const count = Math.floor(Number(units));
  return Number.isFinite(count) && count > 1 ? count : null;
}

function branchPlace(request: RequestCardSource): string | null {
  const location = request.rental_location_listing.business_location;
  const line = [location?.name?.trim(), location?.address?.city?.trim()].filter(Boolean).join(' · ');
  return line || null;
}

function renterName(request: RequestCardSource): string {
  return [request.client?.user?.first_name, request.client?.user?.last_name].filter(Boolean).join(' ');
}

function moneyLines(
  request: RequestCardSource,
  windows: RentalSelectionWindow[],
  total: number | null,
  locale: string,
  t: Copy,
  expired = false
): { amount: string | null; line: string | null; breakdown: string | null } {
  if (total == null) return { amount: null, line: null, breakdown: null };
  const currency = currencyOf(request);
  const amount = formatRequestAmount(total, currency, locale);
  const line = expired
    ? t('rentals.requestCard.wouldHaveReceived', 'Would have received {{amount}}', { amount })
    : t('rentals.requestCard.youReceive', 'You receive {{amount}}', { amount });
  return { amount, line, breakdown: breakdownLine(request, windows, total, currency, locale, t) };
}

function breakdownLine(
  request: RequestCardSource,
  windows: RentalSelectionWindow[],
  total: number,
  currency: string,
  locale: string,
  t: Copy
): string | null {
  if (!windows.length) return null;
  const daily = windows.every((row) => row.billing === 'all_day');
  const hourly = windows.every((row) => row.billing !== 'all_day');
  if (!daily && !hourly) return null;
  const rates = ratesOf(request);
  const units = Math.max(1, Number(request.units_requested) || 1);
  const rows = windows.map((row, index) => ({
    id: String(index),
    startMs: Date.parse(row.start_at),
    endMs: Date.parse(row.end_at),
    billing: row.billing === 'all_day' ? ('all_day' as const) : ('hourly' as const),
    calendarDate: row.calendar_date,
  }));
  const hours = windows.reduce(
    (sum, row) => sum + rentalBillableHours(Date.parse(row.start_at), Date.parse(row.end_at)),
    0
  );
  const days = rows.reduce((count, row) => count + (row.billing === 'all_day' ? 1 : 0), 0);
  // Breakdown must match the frozen contract total, not a live listing rate
  // (quoted_total can disagree with windows × base_price when lines were omitted).
  const dayRate = daily && days > 0 ? total / (days * units) : rates.day;
  const hourRate = hourly && hours > 0 ? total / (hours * units) : rates.hour;
  const priced = requestPriceCopy({
    rows,
    hours,
    units,
    total,
    dayRate,
    hourRate,
    currency,
    language: locale,
    t,
  });
  return priced.priceLabel ?? null;
}

function cardSchedule(
  windows: RentalSelectionWindow[],
  locale: string,
  t: Copy
): RequestCardSchedule {
  if (!windows.length) return { summary: '—', expandable: false, lines: [] };
  const allDay = t('rentals.requestCard.allDay', 'All day');
  if (windows.every((row) => row.billing === 'all_day' && row.calendar_date)) {
    return dailySchedule(windows, locale, allDay, t);
  }
  const lines = windows.map((row) => windowLine(row, locale, allDay));
  if (windows.length === 1) return { summary: lines[0], expandable: false, lines };
  const days = distinctDays(windows);
  return {
    summary: t('rentals.requestCard.seeTimes', '{{count}} days · see times', { count: days }),
    expandable: true,
    lines,
  };
}

function dailySchedule(
  windows: RentalSelectionWindow[],
  locale: string,
  allDay: string,
  t: Copy
): RequestCardSchedule {
  const days = calendarDays(windows);
  const lines = days.map((day) => `${shortDay(day, locale)} · ${allDay}`);
  if (days.length === 1) return { summary: lines[0], expandable: false, lines };
  if (!isContiguous(days) || days.length !== windows.length) {
    return {
      summary: t('rentals.requestCard.seeTimes', '{{count}} days · see times', { count: days.length }),
      expandable: true,
      lines,
    };
  }
  const end = displayedEndDate(windows) ?? addUtcDays(days[days.length - 1], 1);
  const count = t('rentals.requestForm.dayCount', '{{count}} days', { count: windows.length });
  return {
    summary: `${shortDay(days[0], locale)} – ${shortDay(end, locale)} · ${count}`,
    expandable: false,
    lines,
  };
}

function windowLine(row: RentalSelectionWindow, locale: string, allDay: string): string {
  if (row.billing === 'all_day' && row.calendar_date) {
    return `${shortDay(row.calendar_date, locale)} · ${allDay}`;
  }
  const day = row.start_at.slice(0, 10);
  const hours = rentalBillableHours(Date.parse(row.start_at), Date.parse(row.end_at));
  return `${shortDay(day, locale)} · ${clock(row.start_at)}${EN_DASH}${clock(row.end_at)} · ${hours} h`;
}

function shortDay(iso: string, locale: string): string {
  const label = formatRequestDay(iso, locale);
  const space = label.lastIndexOf(' ');
  if (space <= 0) return label;
  return `${label.slice(0, space)}\u00A0${label.slice(space + 1)}`;
}

/** End day follows formatRentalDateRange (exclusive end today; last booked day if that helper changes). */
function displayedEndDate(windows: RentalSelectionWindow[]): string | null {
  const days = calendarDays(windows);
  if (days.length < 2) return null;
  const label = formatRentalDateRange(windows, 'en');
  const nums = [...label.matchAll(/\d+/g)].map((match) => Number(match[0]));
  const endNum = nums.length >= 2 ? nums[1] : nums[0];
  const last = days[days.length - 1];
  const exclusive = addUtcDays(last, 1);
  if (Number(exclusive.slice(8, 10)) === endNum) return exclusive;
  if (Number(last.slice(8, 10)) === endNum) return last;
  return exclusive;
}

function listingStartKey(windows: RentalSelectionWindow[]): string | null {
  if (!windows.length) return null;
  const first = [...windows].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))[0];
  if (first.billing === 'all_day' && first.calendar_date && ISO_DATE.test(first.calendar_date)) {
    return first.calendar_date;
  }
  return ISO_DATE.test(first.start_at.slice(0, 10)) ? first.start_at.slice(0, 10) : null;
}

function windowsOf(request: RequestCardSource): RentalSelectionWindow[] {
  const rows = request.rental_selection_windows;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row.start_at === 'string' && typeof row.end_at === 'string')
    .slice()
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
}

function calendarDays(windows: RentalSelectionWindow[]): string[] {
  const days = windows
    .map((row) => row.calendar_date)
    .filter((day): day is string => Boolean(day && ISO_DATE.test(day)));
  return [...new Set(days)].sort();
}

function distinctDays(windows: RentalSelectionWindow[]): number {
  const keys = new Set(
    windows.map((row) => (row.calendar_date && ISO_DATE.test(row.calendar_date) ? row.calendar_date : row.start_at.slice(0, 10)))
  );
  return Math.max(1, keys.size);
}

function isContiguous(days: string[]): boolean {
  for (let index = 1; index < days.length; index += 1) {
    if (addUtcDays(days[index - 1], 1) !== days[index]) return false;
  }
  return days.length > 1;
}

function addUtcDays(iso: string, offset: number): string {
  const match = ISO_DATE.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function clock(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  return match ? `${match[1]}:${match[2]}` : '';
}

function contractTotal(request: RequestCardSource): number | null {
  const quoted = finiteNumber(request.quoted_total);
  if (quoted != null) return quoted;
  const snap = readSnapshot(request.rental_pricing_snapshot);
  return snap ? finiteNumber(snap.total) : null;
}

function depositAmount(request: RequestCardSource): number {
  const snap = readSnapshot(request.rental_pricing_snapshot);
  if (snap && snap.securityDeposit != null) {
    const frozen = finiteNumber(snap.securityDeposit);
    return frozen != null && frozen > 0 ? frozen : 0;
  }
  const perUnit = finiteNumber(request.rental_location_listing.security_deposit_amount);
  if (perUnit == null || perUnit <= 0) return 0;
  return perUnit * Math.max(1, Number(request.units_requested) || 1);
}

function ratesOf(request: RequestCardSource): { day: number; hour: number } {
  const snap = readSnapshot(request.rental_pricing_snapshot);
  const dayLine = snap?.lines?.find((line) => line.kind === 'all_day');
  const hourLine = snap?.lines?.find((line) => line.kind === 'hourly');
  const day = finiteNumber(dayLine?.ratePerDay) ?? finiteNumber(request.rental_location_listing.base_price_per_day) ?? 0;
  const hour = finiteNumber(hourLine?.ratePerHour) ?? finiteNumber(request.rental_location_listing.base_price_per_hour) ?? 0;
  return { day, hour };
}

function currencyOf(request: RequestCardSource): string {
  const snap = readSnapshot(request.rental_pricing_snapshot);
  return snap?.currency || request.rental_location_listing.rental_item.currency || 'XAF';
}

function readSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== 'object') return null;
  return value as Snapshot;
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

type ChangeSummary = {
  fields?: string[];
  dates?: { from: PeriodWindow[]; to: PeriodWindow[] };
  quantity?: { from: number; to: number };
};

export function formatChangeDetail(summary: ChangeSummary | null | undefined, locale: string): string {
  if (!summary?.fields?.length) return '';
  const bits = changeBits(summary, locale);
  return bits.join(', ');
}

function changeBits(summary: ChangeSummary, locale: string): string[] {
  const bits: string[] = [];
  if (summary.fields?.includes('dates') && summary.dates) bits.push(dateChange(summary, locale));
  if (summary.fields?.includes('quantity') && summary.quantity) {
    bits.push(`quantity ${summary.quantity.from} → ${summary.quantity.to}`);
  }
  if (summary.fields?.includes('notes')) bits.push('notes');
  return bits;
}

function dateChange(summary: ChangeSummary, locale: string): string {
  const dates = summary.dates;
  if (!dates) return '';
  const from = formatRentalDateRange(dates.from, locale);
  const to = formatRentalDateRange(dates.to, locale);
  const sameMonth = dates.from[0]?.calendar_date?.slice(0, 7) === dates.to[0]?.calendar_date?.slice(0, 7);
  const left = sameMonth ? from.replace(/\s+\S+$/, '') : from;
  return `dates ${left} → ${to}`;
}

function requestPriceCopy(input: {
  rows: Array<{ billing: 'all_day' | 'hourly' }>;
  hours: number;
  units: number;
  total: number;
  dayRate: number;
  hourRate: number;
  currency: string;
  language: string;
  t: Copy;
}): { priceLabel?: string } {
  if (input.rows.length > 0 && input.rows.every((row) => row.billing === 'all_day')) {
    return { priceLabel: withUnits(dayLine(input), input.units) };
  }
  return { priceLabel: withUnits(hourLine(input), input.units) };
}

function dayLine(input: { rows: unknown[]; dayRate: number; currency: string; language: string; t: Copy }): string {
  const days = input.t('rentals.requestForm.dayCount', '{{count}} days', { count: input.rows.length });
  const unit = input.language.toLowerCase().startsWith('fr') ? 'jour' : 'day';
  const rate = withRateUnit(formatRequestAmount(input.dayRate, input.currency, input.language), unit);
  return input.t('rentals.requestForm.dailyBreakdown', '{{days}} × {{rate}}', { days, rate });
}

function hourLine(input: { hours: number; hourRate: number; currency: string; language: string; t: Copy }): string {
  const unit = input.language.toLowerCase().startsWith('fr') ? 'heure' : 'hour';
  const rate = withRateUnit(formatRequestAmount(input.hourRate, input.currency, input.language), unit);
  return input.t('rentals.requestForm.hourlyBreakdown', '{{h}} h × {{rate}}', { h: input.hours, rate });
}

function withUnits(line: string, units: number): string {
  return units > 1 ? `${line} × ${units}` : line;
}
