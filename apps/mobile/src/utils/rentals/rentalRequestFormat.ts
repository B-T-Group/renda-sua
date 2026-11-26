import { formatSelectionLabel, localDateKey, type SelectionRange } from './rentalRequestScheduleUtils';
import { formatConfirmationMoney } from './confirmationFormat';
import { withRateUnit } from './moneyRateUnit';
import { listingNowMs } from './dayHoursPicker';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function groupedDigits(amount: number, separator: string): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)}`;
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function utcDate(iso: string): Date | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/**
 * XAF, XOF, and FCFA use `45 000 FCFA` (non-breaking spaces).
 * CAD uses the shared confirmation formatter: `$65.00` / `65,00 $`.
 */
/** A pending request never shows “the business changed the price”. */
export function businessChangedThePrice(
  status: string | null | undefined,
  quoted: unknown,
  accepted: unknown
): boolean {
  if (status !== 'available') return false;
  const left = Number(quoted);
  const right = Number(accepted);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) >= 0.01;
}

export function formatRequestAmount(amount: number, currency: string, language: string): string {
  const code = currency.toUpperCase();
  if (code === 'XAF' || code === 'XOF' || code === 'FCFA') {
    return `${groupedDigits(amount, '\u00A0')}\u00A0FCFA`;
  }
  return formatConfirmationMoney(amount, code, language).replace(/CA\$/g, '$');
}

/** Catalog cards: `45 000 FCFA`, `$45.00`, or `45,00 $`. */
export function formatCatalogMoney(amount: number, currency: string, locale: string): string {
  const code = currency.trim().toUpperCase();
  const value = Number.isFinite(amount) ? amount : 0;
  if (code === 'CAD') return formatCatalogCad(value, locale);
  if (code === 'XAF' || code === 'XOF' || code === 'FCFA') {
    return `${groupedDigits(value, '\u00A0')}\u00A0FCFA`;
  }
  return formatRequestAmount(value, currency, locale);
}

function formatCatalogCad(amount: number, locale: string): string {
  const digits = amount.toFixed(2);
  if (locale.toLowerCase().startsWith('fr')) return `${digits.replace('.', ',')}\u00A0$`;
  return `$${digits}`;
}

/** `Wed 11 Nov` / `Mer. 11 nov.` Never an ISO date. */
export function formatRequestDay(iso: string, locale: string): string {
  const date = utcDate(iso);
  if (!date) return iso;
  const weekday = capitalizeFirst(shortPart(date, locale, 'weekday'));
  return `${weekday} ${date.getUTCDate()} ${formatRentalShortMonth(iso, locale)}`;
}

export function formatRequestChipWeekday(iso: string, locale: string): string {
  const date = utcDate(iso);
  if (!date) return iso;
  return capitalizeFirst(shortPart(date, locale, 'weekday'));
}

export function formatRequestChipDay(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (!match) return iso;
  return String(Number(match[3]));
}

function shortPart(date: Date, locale: string, part: 'weekday' | 'month'): string {
  return new Intl.DateTimeFormat(locale, { [part]: 'short', timeZone: 'UTC' }).format(date);
}

export function selectionCalendarKey(row: Pick<SelectionRange, 'calendarDate' | 'startMs'>): string {
  if (row.calendarDate && ISO_DATE.test(row.calendarDate)) return row.calendarDate;
  return localDateKey(new Date(row.startMs));
}

export function selectedRequestDateKeys(
  rows: Array<Pick<SelectionRange, 'calendarDate' | 'startMs'>>
): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    const key = selectionCalendarKey(row);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** A chip is on only when that calendar day is in the request. Today is not special. */
export function requestChipSelected(dateKey: string, selectedKeys: readonly string[]): boolean {
  return selectedKeys.includes(dateKey);
}

function addUtcDays(iso: string, offset: number): string {
  const date = utcDate(iso);
  if (!date) return iso;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Next days from today, plus any chosen day that falls outside that window. */
export function requestChipDateKeys(
  todayKey: string,
  selectedKeys: readonly string[],
  span = 14
): string[] {
  const keys = new Set<string>();
  for (let i = 0; i < span; i += 1) keys.add(addUtcDays(todayKey, i));
  for (const key of selectedKeys) {
    if (ISO_DATE.test(key)) keys.add(key);
  }
  return [...keys].sort();
}

export function requestUsesDayWording(rows: Array<Pick<SelectionRange, 'billing'>>): boolean {
  return rows.length > 0 && rows.every((row) => row.billing === 'all_day');
}

export function requestDayCount(rows: Array<Pick<SelectionRange, 'billing'>>): number {
  return rows.reduce((count, row) => count + (row.billing === 'all_day' ? 1 : 0), 0);
}

export function requestSelectionLabel(row: SelectionRange, locale: string, allDayLabel: string): string {
  if (row.billing !== 'all_day') return formatSelectionLabel(row.startMs, row.endMs, locale);
  return `${formatRequestDay(selectionCalendarKey(row), locale)} · ${allDayLabel}`;
}

type Copy = (key: string, fallback: string, options?: Record<string, unknown>) => string;

export function requestPriceCopy(input: {
  rows: SelectionRange[];
  hours: number;
  units: number;
  total: number;
  dayRate: number;
  hourRate: number;
  currency: string;
  language: string;
  t: Copy;
}): { priceLabel?: string; priceAmount?: string; hoursCaption?: string; totalAmount: string } {
  if (input.rows.length === 0) return { totalAmount: '—' };
  const totalAmount = formatRequestAmount(input.total, input.currency, input.language);
  if (requestUsesDayWording(input.rows)) return dailyPriceCopy(input, totalAmount);
  return hourlyPriceCopy(input, totalAmount);
}

function dailyPriceCopy(
  input: { rows: SelectionRange[]; units: number; dayRate: number; currency: string; language: string; t: Copy },
  totalAmount: string
) {
  const days = input.t('rentals.requestForm.dayCount', '{{count}} days', { count: requestDayCount(input.rows) });
  const unit = input.language.toLowerCase().startsWith('fr') ? 'jour' : 'day';
  const rate = withRateUnit(formatRequestAmount(input.dayRate, input.currency, input.language), unit);
  const line = input.t('rentals.requestForm.dailyBreakdown', '{{days}} × {{rate}}', { days, rate });
  return { priceLabel: withUnits(line, input.units), priceAmount: totalAmount, totalAmount };
}

function hourlyPriceCopy(
  input: { hours: number; units: number; hourRate: number; currency: string; language: string; t: Copy },
  totalAmount: string
) {
  const unit = input.language.toLowerCase().startsWith('fr') ? 'heure' : 'hour';
  const rate = withRateUnit(formatRequestAmount(input.hourRate, input.currency, input.language), unit);
  const line = input.t('rentals.requestForm.hourlyBreakdown', '{{h}} h × {{rate}}', { h: input.hours, rate });
  return {
    priceLabel: withUnits(line, input.units),
    priceAmount: totalAmount,
    hoursCaption: input.t('rentals.requestForm.totalHoursLineShort', '{{h}} billable hours total', { h: input.hours }),
    totalAmount,
  };
}

function withUnits(line: string, units: number): string {
  return units > 1 ? `${line} × ${units}` : line;
}

const EN_DASH = '\u2013';

export type PeriodWindow = {
  billing?: string;
  calendar_date?: string;
  start_at: string;
  end_at: string;
};

/** Listing wall clock is stored as UTC components. Never format with the device zone. */
export const LISTING_TIME_ZONE = 'Africa/Douala';
export const RENTAL_EDIT_LEAD_MS = 2 * 60 * 60 * 1000;

/**
 * `startIso` is listing wall clock stored as UTC components, so "now" is read on the
 * listing's wall clock (device clock when the zone is unknown), like the server check.
 */
export function rentalEditWindowOpen(
  startIso: string,
  timeZone?: string | null,
  now = Date.now()
): boolean {
  const start = Date.parse(startIso);
  return Number.isFinite(start) && start > listingNowMs(now, timeZone) + RENTAL_EDIT_LEAD_MS;
}

const EN_SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const FR_SHORT_MONTH = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const;

/** `Nov` / `nov.` House short months. FR uses typographic abbreviations (period only when truncated). */
export function formatRentalShortMonth(iso: string, locale: string): string {
  const date = utcDate(iso.slice(0, 10));
  if (!date) return '';
  const months = locale.toLowerCase().startsWith('fr') ? FR_SHORT_MONTH : EN_SHORT_MONTH;
  return months[date.getUTCMonth()];
}

function monthLabel(isoDate: string, locale: string): string {
  return formatRentalShortMonth(isoDate, locale);
}

function dayNum(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

function sameMonth(left: string, right: string): boolean {
  return left.slice(0, 7) === right.slice(0, 7);
}

/** `17 Nov` / `17 nov.` Day then month, never the locale's month-day order. */
export function formatRentalDay(iso: string, locale: string): string {
  const day = iso.slice(0, 10);
  if (!ISO_DATE.test(day)) return iso;
  return `${dayNum(day)} ${monthLabel(day, locale)}`;
}

/** Exclusive-end return morning: `Return 29 Nov` / `Retour le 29\u00A0nov.` */
export function formatReturnDay(iso: string, locale: string): string {
  const day = iso.slice(0, 10);
  if (!ISO_DATE.test(day)) return iso;
  const label = `${dayNum(day)}\u00A0${monthLabel(day, locale)}`;
  return locale.toLowerCase().startsWith('fr') ? `Retour le ${label}` : `Return ${label}`;
}

/** Calendar day after the last booked day (the exclusive end / return morning). */
export function returnDateAfterBookedDays(booked: string[]): string | undefined {
  if (!booked.length) return undefined;
  return addUtcDays(booked[booked.length - 1], 1);
}

export function appendReturnDay(line: string, returnIso: string | undefined, locale: string): string {
  if (!returnIso || !line || line === '—' || line === '\u2014') return line;
  return `${line} · ${formatReturnDay(returnIso, locale)}`;
}

function periodLineWithReturn(windows: PeriodWindow[], locale: string, line: string): string {
  const booked = bookedCalendarDates(windows);
  return appendReturnDay(line, booked ? returnDateAfterBookedDays(booked) : undefined, locale);
}

/** Daily request/booking summary: booked days, count, and the return morning. Hourly is unchanged. */
export function formatRequestedPeriod(
  windows: PeriodWindow[],
  locale: string,
  dayCountLabel: (count: number) => string
): string {
  return periodLineWithReturn(windows, locale, formatRentalPeriod(windows, locale, dayCountLabel));
}

/**
 * `12 Nov` or `15–17 Nov`. `calendar_date` values are booked days, and the last one is included.
 * Listing wall clock is the Z components (Africa/Douala stored as UTC).
 */
export function formatRentalDateRange(windows: PeriodWindow[], locale: string): string {
  const days = windows
    .map((row) => row.calendar_date)
    .filter((day): day is string => Boolean(day && ISO_DATE.test(day)))
    .sort();
  if (!days.length) return '';
  const start = days[0];
  const end = days[days.length - 1];
  const endMonth = monthLabel(end, locale);
  if (start === end) return `${dayNum(start)} ${endMonth}`;
  const startMonth = monthLabel(start, locale);
  if (sameMonth(start, end)) return `${dayNum(start)}${EN_DASH}${dayNum(end)} ${endMonth}`;
  return `${dayNum(start)} ${startMonth} ${EN_DASH} ${dayNum(end)} ${endMonth}`;
}

function clock(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  return match ? `${match[1]}:${match[2]}` : '';
}

function hourlyLine(row: PeriodWindow, locale: string): string {
  const day = row.start_at.slice(0, 10);
  const month = monthLabel(day, locale);
  const start = clock(row.start_at);
  const end = clock(row.end_at);
  const times = start && end && start !== end ? `${start}${EN_DASH}${end}` : start || end;
  return `${dayNum(day)} ${month} · ${times}`;
}

/** Douala wall-clock components stored with a Z suffix: `12 Nov · 21:00`. */
export function formatListingDue(iso: string, locale: string): string {
  const day = iso.slice(0, 10);
  const time = clock(iso);
  if (!ISO_DATE.test(day) || !time) return iso;
  return `${dayNum(day)}\u00A0${monthLabel(day, locale)}\u00A0·\u00A0${time}`;
}

/** Booked calendar days. A same-clock end the next morning is the return, not another booked day. */
function bookedDayKeys(row: PeriodWindow): string[] | null {
  if (row.billing === 'all_day' && row.calendar_date && ISO_DATE.test(row.calendar_date)) {
    return [row.calendar_date];
  }
  const start = row.start_at.slice(0, 10);
  const end = row.end_at.slice(0, 10);
  const startClock = clock(row.start_at);
  const endClock = clock(row.end_at);
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || !startClock || startClock !== endClock) return null;
  if (end <= start) return null;
  const keys: string[] = [];
  let cursor = start;
  while (cursor < end && keys.length < 366) {
    keys.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return keys.length ? keys : null;
}

function bookedCalendarDates(windows: PeriodWindow[]): string[] | null {
  const days: string[] = [];
  for (const row of windows) {
    const keys = bookedDayKeys(row);
    if (!keys) return null;
    days.push(...keys);
  }
  const unique = [...new Set(days)].sort();
  return unique.length ? unique : null;
}

export function formatRentalPeriod(
  windows: PeriodWindow[],
  locale: string,
  dayCountLabel: (count: number) => string
): string {
  if (!windows.length) return '—';
  const booked = bookedCalendarDates(windows);
  if (booked) {
    const asWindows = booked.map((calendar_date) => ({ calendar_date, start_at: '', end_at: '' }));
    return `${formatRentalDateRange(asWindows, locale)} · ${dayCountLabel(booked.length)}`;
  }
  return windows.map((row) => hourlyLine(row, locale)).join(', ');
}

function isContiguous(days: string[]): boolean {
  if (days.length <= 1) return true;
  return days.every((day, index) => index === 0 || day === addUtcDays(days[index - 1], 1));
}

/** One stay: a single window, or contiguous daily days that read as one range. */
export function isSingleRequestedPeriod(windows: PeriodWindow[]): boolean {
  if (windows.length <= 1) return true;
  const booked = bookedCalendarDates(windows);
  return Boolean(booked && isContiguous(booked));
}

/**
 * One line when the request is a single period.
 * Numbered lines only when the request has several separate periods.
 * Keep in sync with apps/frontend/src/utils/rentalRequestFormat.ts
 */
export function clientRequestPeriodLines(
  windows: PeriodWindow[],
  locale: string,
  dayCountLabel: (count: number) => string
): string[] {
  if (!windows.length) return [];
  if (isSingleRequestedPeriod(windows)) {
    return [formatRequestedPeriod(windows, locale, dayCountLabel)];
  }
  return windows.map((window, index) => numberedPeriodLine(window, index, locale, dayCountLabel));
}

function numberedPeriodLine(
  window: PeriodWindow,
  index: number,
  locale: string,
  dayCountLabel: (count: number) => string
): string {
  return periodLineWithReturn([window], locale, `${index + 1}. ${formatRentalPeriod([window], locale, dayCountLabel)}`);
}

/** Selection windows when the booking has them; otherwise the booked start–end span. */
export function bookingPeriodWindows(
  windows: PeriodWindow[],
  span?: { start_at?: string | null; end_at?: string | null } | null
): PeriodWindow[] {
  if (windows.length) return windows;
  if (!span?.start_at || !span.end_at) return [];
  return [{ start_at: span.start_at, end_at: span.end_at }];
}

export function bookingRequestedPeriodLines(
  windows: PeriodWindow[],
  span: { start_at?: string | null; end_at?: string | null } | null | undefined,
  locale: string,
  dayCountLabel: (count: number) => string
): string[] {
  return clientRequestPeriodLines(bookingPeriodWindows(windows, span), locale, dayCountLabel);
}

/** Booking detail: keep a cross-day clock span when present, and append the return morning for a daily stay. */
export function bookingDetailPeriodLines(
  windows: PeriodWindow[],
  span: { start_at?: string | null; end_at?: string | null } | null | undefined,
  locale: string,
  dayCountLabel: (count: number) => string,
  bookedSpan?: string | null
): string[] {
  if (bookedSpan) {
    const resolved = bookingPeriodWindows(windows, span);
    const booked = bookedCalendarDates(resolved);
    const ret = booked && isContiguous(booked) ? returnDateAfterBookedDays(booked) : undefined;
    return [appendReturnDay(bookedSpan, ret, locale)];
  }
  return bookingRequestedPeriodLines(windows, span, locale, dayCountLabel);
}

/** `Fri 20 Nov, 10:00` / `ven. 20 nov., 10:00`. Clock is the listing wall time stored on the Z timestamp. */
export function formatListingDeadline(iso: string, locale: string): string {
  const day = iso.slice(0, 10);
  const time = clock(iso);
  if (!ISO_DATE.test(day) || !time) return iso;
  const label = formatRequestDay(day, locale);
  const french = locale.toLowerCase().startsWith('fr');
  const dayLabel = french ? `${label.charAt(0).toLocaleLowerCase()}${label.slice(1)}` : label;
  return `${dayLabel}, ${time}`;
}

export function rentalSelectionFingerprint(
  rows: Array<{ billing: string; calendarDate?: string; startMs: number; endMs: number }>,
  units: number,
  notes: string
): string {
  const parts = rows
    .map((row) => `${row.billing}|${row.calendarDate ?? ''}|${row.startMs}|${row.endMs}`)
    .sort();
  return `${parts.join(';')}#${units}#${notes.trim()}`;
}

export function modifySaveNeedsConfirm(nextTotal: number, previousTotal: number): boolean {
  return nextTotal > previousTotal + 0.009;
}

export interface PriceConfirmQuote {
  total: number;
  currency: string;
  previousTotal: number | null;
}

/** Server 409 body: the locked re-quote the confirm sheet must show. */
export function readPriceConfirmQuote(error: unknown): PriceConfirmQuote | null {
  if (!error || typeof error !== 'object') return null;
  const row = error as {
    code?: string;
    data?: { quote?: { total?: unknown; currency?: unknown; previousTotal?: unknown } };
  };
  if (row.code !== 'PRICE_CONFIRM_REQUIRED') return null;
  const quote = row.data?.quote;
  const total = Number(quote?.total);
  const currency = typeof quote?.currency === 'string' ? quote.currency : '';
  if (!Number.isFinite(total) || !currency) return null;
  const previous = quote?.previousTotal == null ? null : Number(quote.previousTotal);
  return {
    total,
    currency,
    previousTotal: previous != null && Number.isFinite(previous) ? previous : null,
  };
}

type ChangeSummary = {
  fields?: string[];
  dates?: { from: PeriodWindow[]; to: PeriodWindow[] };
  quantity?: { from: number; to: number };
};

export function formatChangeDetail(summary: ChangeSummary | null | undefined, locale: string): string {
  if (!summary?.fields?.length) return '';
  const bits: string[] = [];
  if (summary.fields.includes('dates') && summary.dates) {
    const from = formatRentalDateRange(summary.dates.from, locale);
    const to = formatRentalDateRange(summary.dates.to, locale);
    const fromMonth = summary.dates.from[0]?.calendar_date?.slice(0, 7);
    const toMonth = summary.dates.to[0]?.calendar_date?.slice(0, 7);
    const left = fromMonth && fromMonth === toMonth ? from.replace(/\s+\S+$/, '') : from;
    bits.push(`dates ${left} → ${to}`);
  }
  if (summary.fields.includes('quantity') && summary.quantity) {
    bits.push(`quantity ${summary.quantity.from} → ${summary.quantity.to}`);
  }
  if (summary.fields.includes('notes')) bits.push('notes');
  return bits.join(', ');
}
