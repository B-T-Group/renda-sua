import { formatConfirmationMoney, confirmationTimeZone } from './confirmationFormat';
import { isFcfa, reservationFee, type ReserveMode } from './reservationFee';

/**
 * Reserve dialog (approved 01a/01b), shared by mobile and web.
 * Request windows are listing wall clock stored as UTC components, so they are read on UTC
 * and labelled with the listing's 12/24-hour habit (English in the Americas → 12-hour).
 */
type Translate = (key: string, fallback: string, vars?: Record<string, unknown>) => string;

export interface ReserveWindow {
  start_at: string;
  end_at: string;
}

export interface ReserveQuote {
  currency: string;
  total: number;
  securityDeposit?: number | null;
  lines?: Array<{ kind?: string; billableHours?: number; ratePerHour?: number; subtotal?: number; calendarDate?: string }>;
}

export interface ReserveSummaryInput {
  mode: ReserveMode;
  windows: ReserveWindow[];
  quote: ReserveQuote | null;
  booking?: { reservation_fee_amount?: number | string | null; inspection_policy_version?: number | null } | null;
  listingZone?: string | null;
  country?: string | null;
  placeName?: string | null;
  city?: string | null;
  deadlineIso?: string | null;
  isStripeRail?: boolean;
  language: string;
  t: Translate;
}

export type ReserveIcon = 'calendar' | 'clock' | 'shield' | 'pin' | 'camera' | 'timer' | 'refund';

export interface ReserveRow {
  key: string;
  icon: ReserveIcon;
  label: string;
  value: string;
  sub?: string;
  /** Long values (addresses): label on top, value on its own full-width line. */
  stacked?: boolean;
}

export interface ReserveFooterLine {
  title: string;
  sub: string;
  amount: string;
}

export interface ReserveSummary {
  rows: ReserveRow[];
  /** "Reservation fee · 150 FCFA" box (fee mode) or "Nothing to pay today" box. */
  box: { kind: 'fee' | 'free'; title: string; lines: Array<{ icon: 'check' | 'refund' | 'warn' | 'card'; text: string; warn?: boolean }> };
  cancelLine: string;
  footer: { today: ReserveFooterLine; pickup: ReserveFooterLine };
  button: string;
}

const NBSP = '\u00a0';

export function isFrench(language: string): boolean {
  return (language || '').toLowerCase().startsWith('fr');
}

export function uses12hClock(language: string, zone?: string | null): boolean {
  return !isFrench(language) && (zone ?? '').startsWith('America/');
}

function parts(iso: string, zone: string) {
  const out = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const v = (type: string) => Number(out.find((p) => p.type === type)?.value ?? 0);
  return { year: v('year'), month: v('month'), day: v('day'), hour: v('hour'), minute: v('minute') };
}

/** "Sat 28 Nov" / "sam. 28 nov." on `zone` (UTC for wall-clock fields). */
export function weekdayDay(iso: string, language: string, zone = 'UTC'): string {
  const fr = isFrench(language);
  const date = new Date(iso);
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(fr ? 'fr-CA' : 'en-GB', { timeZone: zone, ...o }).format(date).replace(/\.$/, '');
  const weekday = fmt({ weekday: 'short' });
  const month = fmt({ month: 'short' });
  const day = parts(iso, zone).day;
  return fr ? `${weekday.toLowerCase()}.${NBSP}${day}${NBSP}${month.toLowerCase()}.` : `${weekday} ${day} ${month}`;
}

function clock(hour: number, minute: number, twelve: boolean, suffix = true): string {
  const mm = String(minute).padStart(2, '0');
  if (!twelve) return `${String(hour).padStart(2, '0')}:${mm}`;
  return `${hour % 12 || 12}:${mm}${suffix ? ` ${hour < 12 ? 'AM' : 'PM'}` : ''}`;
}

/** "14:00" / "2:00 PM" for an instant read on `zone`. */
export function clockTime(iso: string, language: string, listingZone?: string | null, zone = 'UTC'): string {
  const p = parts(iso, zone);
  return clock(p.hour, p.minute, uses12hClock(language, listingZone));
}

/** "14:00–18:00", "2:00–6:00 PM", "11:00 AM–1:00 PM". */
export function clockRange(startIso: string, endIso: string, language: string, listingZone?: string | null, zone = 'UTC'): string {
  const a = parts(startIso, zone);
  const b = parts(endIso, zone);
  const twelve = uses12hClock(language, listingZone);
  const sameHalf = (a.hour < 12) === (b.hour < 12);
  return `${clock(a.hour, a.minute, twelve, !(twelve && sameHalf))}–${clock(b.hour, b.minute, twelve)}`;
}

/** "Sat 28 Nov · 14:00–18:00", or both ends dated when the window spans days. */
export function windowLabel(w: ReserveWindow, language: string, listingZone?: string | null): string {
  const sameDay = w.start_at.slice(0, 10) === w.end_at.slice(0, 10);
  if (sameDay) return `${weekdayDay(w.start_at, language)} · ${clockRange(w.start_at, w.end_at, language, listingZone)}`;
  return `${weekdayDay(w.start_at, language)} · ${clockTime(w.start_at, language, listingZone)} – ${weekdayDay(w.end_at, language)} · ${clockTime(w.end_at, language, listingZone)}`;
}

/** End of the listing day for deadline copy: "11:59 PM" for English in the Americas, else "23:59". */
export function dayEndDeadline(language: string, zone?: string | null): string {
  return uses12hClock(language, zone) ? '11:59\u00a0PM' : '23:59';
}

/** The day before the (wall-clock) start: free cancellation ends at 23:59 that day. */
export function dayBefore(startIso: string, language: string): string {
  const prev = new Date(Date.parse(startIso) - 86_400_000).toISOString();
  return weekdayDay(prev, language);
}

function round(value: number, currency: string): number {
  return isFcfa(currency) ? Math.round(value) : Number(value.toFixed(2));
}

export function reserveZone(input: Pick<ReserveSummaryInput, 'listingZone' | 'country' | 'quote'>): string {
  return input.listingZone || confirmationTimeZone(input.country, input.quote?.currency);
}

export function buildReserveSummary(input: ReserveSummaryInput): ReserveSummary {
  const { t, language, quote } = input;
  const currency = quote?.currency ?? 'XAF';
  const money = (n: number) => formatConfirmationMoney(n, currency, language);
  const zone = reserveZone(input);
  const total = quote?.total ?? 0;
  const fee = input.mode === 'fee' ? Math.min(reservationFee(input.booking), total) : 0;
  const due = round(total - fee, currency);
  const card = Boolean(input.isStripeRail);
  const deposit = card ? Number(quote?.securityDeposit) || 0 : 0;
  const first = input.windows[0];
  const last = input.windows[input.windows.length - 1];
  const rows: ReserveRow[] = [];
  if (first && last) {
    if (input.windows.length === 1) {
      rows.push({ key: 'dates', icon: 'calendar', label: t('rentals.reserve.dates', 'Dates'), value: windowLabel(first, language, zone) });
    } else {
      input.windows.forEach((w, i) =>
        rows.push({
          key: `window-${i}`,
          icon: 'calendar',
          label: t('rentals.clientRequests.bookConfirmLabelWindow', 'Window {{index}}', { index: i + 1 }),
          value: windowLabel(w, language, zone),
        })
      );
    }
  }
  if (quote) {
    rows.push({ key: 'rental', icon: 'clock', label: t('rentals.reserve.rental', 'Rental'), value: money(total), sub: rateSub(quote, money, t) });
  }
  if (card) {
    rows.push({
      key: 'deposit',
      icon: 'shield',
      label: t('rentals.reserve.deposit', 'Security deposit'),
      value: deposit > 0 ? money(deposit) : t('rentals.reserve.none', 'None'),
      sub: deposit > 0 ? t('rentals.reserve.depositSub', 'Held on your card at pickup') : undefined,
    });
  }
  const place = [input.placeName?.trim(), input.city?.trim()].filter(Boolean).join(' · ');
  if (place) rows.push({ key: 'pickup', icon: 'pin', label: t('rentals.reserve.pickup', 'Pickup'), value: place, stacked: true });
  if (input.booking?.inspection_policy_version != null) {
    rows.push({ key: 'check', icon: 'camera', label: t('rentals.reserve.itemCheck', 'Item check'), value: t('rentals.reserve.photosAtPickup', 'Photos at pickup') });
  }
  if (input.mode === 'free') {
    rows.push({ key: 'cancel', icon: 'refund', label: t('rentals.reserve.cancellation', 'Cancellation'), value: t('rentals.reserve.cancellationFree', 'Free') });
  }
  if (input.deadlineIso) {
    rows.push({
      key: 'deadline',
      icon: 'timer',
      label: t('rentals.clientRequests.bookConfirmLabelAcceptBy', 'Offer valid until'),
      value: `${weekdayDay(input.deadlineIso, language, zone)} · ${clockTime(input.deadlineIso, language, zone, zone)}`,
    });
  }
  const startDay = first ? weekdayDay(first.start_at, language) : '';
  const cardLine = card
    ? {
        icon: 'card' as const,
        text: t(
          'rentals.reserve.cardNothingHeld',
          'Nothing is held on your card today. At pickup, after you check the item, we charge {{due}} and hold a {{deposit}} deposit. Booking must end within 6 days.',
          { due: money(due), deposit: money(deposit) }
        ),
      }
    : null;
  const box: ReserveSummary['box'] =
    input.mode === 'fee'
      ? {
          kind: 'fee',
          title: t('rentals.reserve.feeTitle', 'Reservation fee · {{fee}}', { fee: money(fee) }),
          lines: [
            { icon: 'check', text: t('rentals.reserve.feeCounts', 'Counts toward your total · Pay at pickup {{due}}, after you check the item.', { due: money(due) }) },
            { icon: 'refund', text: t('rentals.reserve.feeRefunded', 'Refunded if you cancel before {{day}}, or if the business cancels or the item doesn’t match.', { day: startDay }) },
            { icon: 'warn', warn: true, text: t('rentals.reserve.feeKept', 'Kept by the business if you don’t come to pick up.') },
            ...(cardLine ? [cardLine] : []),
          ],
        }
      : {
          kind: 'free',
          title: t('rentals.reserve.nothingTitle', 'Nothing to pay today'),
          lines: [cardLine ?? { icon: 'check', text: t('rentals.reserve.nothingBody', 'You pay at the shop, after you’ve seen the item and it matches the photos.') }],
        };
  const rail = card ? t('rentals.reserve.railCard', 'Card') : t('rentals.reserve.railMomo', 'Mobile Money');
  return {
    rows,
    box,
    cancelLine:
      input.mode === 'fee' && first
        ? t('rentals.reserve.freeCancelUntil', 'Free cancellation until {{day}} · {{deadline}}', { day: dayBefore(first.start_at, language), deadline: dayEndDeadline(language, zone) })
        : '',
    footer: {
      today: {
        title: t('rentals.reserve.payToday', 'Pay today'),
        sub: input.mode === 'fee' ? t('rentals.reserve.payTodayFeeSub', 'Reservation fee · {{rail}}', { rail }) : t('rentals.reserve.payTodayNone', 'No payment now'),
        amount: money(fee),
      },
      pickup: {
        title: t('rentals.reserve.payAtPickup', 'Pay at pickup'),
        sub: pickupSub({ deposit, fee: input.mode === 'fee', money, t }),
        amount: money(due),
      },
    },
    button:
      input.mode === 'fee'
        ? t('rentals.payAtPickup.reserveFeeButton', 'Pay {{fee}} & reserve', { fee: money(fee) })
        : t('rentals.payAtPickup.reserveFreeButton', 'Reserve · pay at pickup'),
  };
}

function pickupSub(p: { deposit: number; fee: boolean; money: (n: number) => string; t: Translate }): string {
  const base = p.fee
    ? p.t('rentals.reserve.payAtPickupFeeSub', 'After you check the item · fee already deducted')
    : p.t('rentals.reserve.payAtPickupSub', 'After you check the item');
  if (p.deposit <= 0) return base;
  return `${base} · ${p.t('rentals.reserve.plusDeposit', '+ {{deposit}} deposit hold', { deposit: p.money(p.deposit) })}`;
}

function rateSub(quote: ReserveQuote, money: (n: number) => string, t: Translate): string | undefined {
  const lines = quote.lines ?? [];
  if (lines.length !== 1) return undefined;
  const line = lines[0];
  if (line.kind === 'all_day') return t('rentals.reserve.fullDay', 'Full day');
  if (!line.billableHours || !line.ratePerHour) return undefined;
  return `${line.billableHours}${NBSP}h × ${money(line.ratePerHour)}`;
}
