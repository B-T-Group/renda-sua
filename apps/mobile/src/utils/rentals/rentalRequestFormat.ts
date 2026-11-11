import { formatSelectionLabel, localDateKey, type SelectionRange } from './rentalRequestScheduleUtils';
import { formatRentalMoney } from './rentalRequestDisplay';

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

/** Request screen only: number, then currency (`760 FCFA`) in EN and FR. */
export function formatRequestAmount(amount: number, currency: string, language: string): string {
  const code = currency.toUpperCase();
  if (code === 'XAF' || code === 'FCFA') {
    const french = language.toLowerCase().startsWith('fr');
    const grouped = groupedDigits(amount, ' ');
    return `${grouped} FCFA`;
  }
  return formatRentalMoney(amount, currency);
}

/** `Wed 11 Nov` / `Mer. 11 nov.` Never an ISO date. */
export function formatRequestDay(iso: string, locale: string): string {
  const date = utcDate(iso);
  if (!date) return iso;
  const weekday = capitalizeFirst(shortPart(date, locale, 'weekday'));
  const monthRaw = shortPart(date, locale, 'month');
  const french = locale.toLowerCase().startsWith('fr');
  const month = french ? monthRaw : capitalizeFirst(monthRaw);
  return `${weekday} ${date.getUTCDate()} ${month}`;
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
  const rate = formatRequestAmount(input.dayRate, input.currency, input.language);
  const line = input.t('rentals.requestForm.dailyBreakdown', '{{days}} × {{rate}} / day', { days, rate });
  return { priceLabel: withUnits(line, input.units), priceAmount: totalAmount, totalAmount };
}

function hourlyPriceCopy(
  input: { hours: number; units: number; hourRate: number; currency: string; language: string; t: Copy },
  totalAmount: string
) {
  const rate = formatRequestAmount(input.hourRate, input.currency, input.language);
  const line = input.t('rentals.requestForm.hourlyBreakdown', '{{h}} h × {{rate}} / hour', { h: input.hours, rate });
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

export function rentalEditWindowOpen(startIso: string, now = Date.now()): boolean {
  const start = Date.parse(startIso);
  return Number.isFinite(start) && start > now + RENTAL_EDIT_LEAD_MS;
}

function monthLabel(isoDate: string, locale: string): string {
  const date = utcDate(isoDate);
  if (!date) return '';
  const french = locale.toLowerCase().startsWith('fr');
  const raw = new Intl.DateTimeFormat(french ? 'fr' : 'en', { month: 'short', timeZone: 'UTC' }).format(date);
  return french ? raw : capitalizeFirst(raw.replace(/\./g, ''));
}

function dayNum(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

function exclusiveEnd(isoDate: string): string {
  return addUtcDays(isoDate, 1);
}

function sameMonth(left: string, right: string): boolean {
  return left.slice(0, 7) === right.slice(0, 7);
}

/** `15–17 Nov` from all-day calendar dates, using the exclusive end day. */
export function formatRentalDateRange(windows: PeriodWindow[], locale: string): string {
  const days = windows
    .map((row) => row.calendar_date)
    .filter((day): day is string => Boolean(day && ISO_DATE.test(day)))
    .sort();
  if (!days.length) return '';
  const start = days[0];
  const end = exclusiveEnd(days[days.length - 1]);
  const startMonth = monthLabel(start, locale);
  const endMonth = monthLabel(end, locale);
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
  return `${dayNum(day)} ${month} · ${clock(row.start_at)}${EN_DASH}${clock(row.end_at)}`;
}

export function formatRentalPeriod(
  windows: PeriodWindow[],
  locale: string,
  dayCountLabel: (count: number) => string
): string {
  if (!windows.length) return '—';
  const daily = windows.every((row) => row.billing === 'all_day' && row.calendar_date);
  if (daily) {
    const count = windows.length;
    return `${formatRentalDateRange(windows, locale)} · ${dayCountLabel(count)}`;
  }
  return windows.map((row) => hourlyLine(row, locale)).join(', ');
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
