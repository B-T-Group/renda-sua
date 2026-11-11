import { formatSelectionLabel, localDateKey, type SelectionRange } from './rentalRequestScheduleUtils';
import { formatRentalMoney } from './rentalRequestDisplay';

const NARROW_NO_BREAK_SPACE = '\u202f';
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
    const grouped = groupedDigits(amount, french ? NARROW_NO_BREAK_SPACE : ',');
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
