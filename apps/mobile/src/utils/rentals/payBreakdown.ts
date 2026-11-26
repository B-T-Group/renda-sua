import { formatConfirmationMoney } from './confirmationFormat';
import { feePaid } from './reservationFee';
import { startMoney, type StartMoneyBooking } from './startMoney';

/**
 * Pay & start breakdown (approved 05a / 05b). Card: rental, paid fee, charged now, deposit hold,
 * and the "on your card today" footer. Mobile Money / wallet: rental, paid fee, to pay now (no deposit).
 */
type Translate = (key: string, fallback: string, vars?: Record<string, unknown>) => string;

export interface PayBreakdownBooking extends StartMoneyBooking {
  start_at?: string | null;
  end_at?: string | null;
  rental_pricing_snapshot?: unknown;
}

export interface PayBreakdownRow {
  key: 'rental' | 'fee' | 'now' | 'deposit';
  icon: 'clock' | 'check' | 'card' | 'momo' | 'wallet' | 'shield';
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
}

export interface PayBreakdown {
  rail: 'card' | 'momo' | 'wallet';
  rows: PayBreakdownRow[];
  footer: string | null;
  /** Amount the button charges now. */
  now: string;
}

const MINUS = '\u2212';
const NBSP = '\u00a0';

export function rentalHours(b: PayBreakdownBooking): number | null {
  const snap = b.rental_pricing_snapshot as { lines?: Array<{ kind?: string; billableHours?: number }> } | null | undefined;
  const lines = snap?.lines ?? [];
  if (lines.length && lines.every((l) => l.kind !== 'all_day' && Number(l.billableHours) > 0)) {
    return lines.reduce((sum, l) => sum + Number(l.billableHours), 0);
  }
  const start = Date.parse(b.start_at ?? '');
  const end = Date.parse(b.end_at ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const hours = (end - start) / 3_600_000;
  return hours <= 24 && Number.isInteger(hours) ? hours : null;
}

export function payBreakdown(b: PayBreakdownBooking, language: string, t: Translate): PayBreakdown | null {
  const money = startMoney(b);
  if (money.kind !== 'card_due' && money.kind !== 'momo_due' && money.kind !== 'wallet_due') return null;
  const format = (n: number) => formatConfirmationMoney(n, b.currency, language);
  const total = Number(b.total_amount) || 0;
  const fee = feePaid(b);
  const hours = rentalHours(b);
  const rail = money.kind === 'card_due' ? 'card' : money.kind === 'wallet_due' ? 'wallet' : 'momo';
  const rows: PayBreakdownRow[] = [
    {
      key: 'rental',
      icon: 'clock',
      label: hours ? t('rentals.pay.rentalHours', 'Rental · {{hours}} h', { hours: String(hours).replace(' ', NBSP) }) : t('rentals.pay.rental', 'Rental'),
      value: format(total),
    },
  ];
  if (fee > 0) rows.push({ key: 'fee', icon: 'check', label: t('rentals.pay.feePaid', 'Reservation fee paid'), value: `${MINUS}${format(fee)}` });
  rows.push({
    key: 'now',
    icon: rail,
    label: rail === 'card' ? t('rentals.pay.chargedNow', 'Charged now') : t('rentals.pay.toPayNow', 'To pay now'),
    value: format(money.amount),
    strong: true,
  });
  let footer: string | null = null;
  if (money.kind === 'card_due' && money.deposit > 0) {
    rows.push({
      key: 'deposit',
      icon: 'shield',
      label: t('rentals.pay.depositHold', 'Deposit hold'),
      value: format(money.deposit),
      sub: t('rentals.pay.depositReleased', 'released after the return check'),
    });
    footer = t('rentals.pay.cardFooter', '{{total}} on your card today · {{deposit}} of it is a hold', {
      total: format(Number((money.amount + money.deposit).toFixed(2))),
      deposit: format(money.deposit),
    });
  }
  return { rail, rows, footer, now: format(money.amount) };
}
