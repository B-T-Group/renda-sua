export type DeclineRail = 'card' | 'wallet' | 'momo_unpaid' | 'momo_paid';
export type RefundStatus = 'none' | 'refund_pending' | 'refunded' | 'failed';

export interface CollectedPayment {
  amount: number;
  currency: string;
  provider: string;
  phone: string | null;
  transactionId: string | null;
}

/** Two-decimal money. Non-finite or non-positive values contribute nothing. */
export function moneyAmount(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100) / 100;
}

/** Never refund more than the ledger collected. The client does not choose the amount. */
export function capRefund(collected: number, attempted: number): number {
  const paid = moneyAmount(collected);
  const ask = moneyAmount(attempted);
  if (ask <= 0 || paid <= 0) return 0;
  return Math.min(ask, paid);
}

export function sumCollected(rows: CollectedPayment[], currency: string): number {
  const code = currency.trim().toUpperCase();
  const total = rows.reduce((sum, row) => {
    if (row.currency.trim().toUpperCase() !== code) return sum;
    return sum + moneyAmount(row.amount);
  }, 0);
  return Math.round(total * 100) / 100;
}

export function declineRail(input: {
  collected: number;
  authorizedAmount: number;
  walletHold: number;
}): DeclineRail {
  if (moneyAmount(input.collected) > 0) return 'momo_paid';
  if (moneyAmount(input.authorizedAmount) > 0) return 'card';
  if (moneyAmount(input.walletHold) > 0) return 'wallet';
  return 'momo_unpaid';
}

/** Latest successful collect in the booking currency. The provider call uses this row. */
export function refundSource(rows: CollectedPayment[], currency: string): CollectedPayment | null {
  const code = currency.trim().toUpperCase();
  const matches = rows.filter((row) => row.currency.trim().toUpperCase() === code && moneyAmount(row.amount) > 0);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

export function maskMomoPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const tail = digits.slice(-4);
  if (tail.length < 4) return '·····';
  return `····· ${tail.slice(0, 2)} ${tail.slice(2)}`;
}

export type ProviderRefundPlan = 'mtn' | 'freemopay' | 'fedapay' | 'unsupported';

/** MTN, FreemoPay, and FedaPay can send money back. MyPVit and Orange cannot. */
export function providerRefundPlan(provider: string): ProviderRefundPlan {
  const name = provider.trim().toLowerCase();
  if (name === 'mtn' || name === 'mtn_momo') return 'mtn';
  if (name === 'freemopay' || name === 'freemo') return 'freemopay';
  if (name === 'fedapay') return 'fedapay';
  return 'unsupported';
}

const REFUNDED = new Set(['successful', 'success', 'approved', 'transferred', 'sent']);
const FAILED = new Set(['failed', 'failure', 'declined', 'canceled', 'cancelled', 'rejected']);

export function mapRefundPoll(code: string | null | undefined): 'refunded' | 'failed' | 'pending' {
  const normalized = (code ?? '').trim().toLowerCase();
  if (REFUNDED.has(normalized)) return 'refunded';
  if (FAILED.has(normalized)) return 'failed';
  return 'pending';
}

/** Full ledger refund, still capped if a caller passes the booking total by mistake. */
export function refundFromLedger(collected: number, bookingTotal: number): number {
  const paid = moneyAmount(collected);
  return capRefund(paid, Math.max(paid, moneyAmount(bookingTotal)));
}
