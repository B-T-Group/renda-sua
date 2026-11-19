import { createHash } from 'crypto';

export type DeclineRail = 'card' | 'wallet' | 'momo_unpaid' | 'momo_paid';
export type RefundStatus = 'none' | 'refund_pending' | 'refunded' | 'failed' | 'manual';

export interface CollectedPayment {
  amount: number;
  currency: string;
  provider: string;
  phone: string | null;
  transactionId: string | null;
  /** Operator or channel stored on the original collect, when the provider sent one. */
  channel?: string | null;
}

export interface DeclineWallet {
  available: number;
  withheld: number;
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

export function mapRefundPoll(code: string | null | undefined): 'refunded' | 'failed' | 'refund_pending' {
  const normalized = (code ?? '').trim().toLowerCase();
  if (REFUNDED.has(normalized)) return 'refunded';
  if (FAILED.has(normalized)) return 'failed';
  return 'refund_pending';
}

/** Full ledger refund, still capped if a caller passes the booking total by mistake. */
export function refundFromLedger(collected: number, bookingTotal: number): number {
  const paid = moneyAmount(collected);
  return capRefund(paid, Math.max(paid, moneyAmount(bookingTotal)));
}

/**
 * One payout. Release the withheld hold into available, then debit that same
 * amount. Available does not rise, so a phone payout is not a second refund.
 */
export function consumeHoldForPayout(wallet: DeclineWallet, amount: number): DeclineWallet {
  const payout = moneyAmount(amount);
  const released = Math.min(Math.max(wallet.withheld, 0), payout);
  const available = Math.round((wallet.available + released - payout) * 100) / 100;
  const withheld = Math.round((Math.max(wallet.withheld, 0) - released) * 100) / 100;
  return { available, withheld };
}

/** Definitive payout failure. The debit comes back to the wallet. The phone was not paid. */
export function creditFailedPayout(wallet: DeclineWallet, amount: number): DeclineWallet {
  return {
    available: Math.round((wallet.available + moneyAmount(amount)) * 100) / 100,
    withheld: wallet.withheld,
  };
}

const MOOV_PREFIXES = ['78', '79', '96', '97', '98', '99'];

/** FedaPay channel from the collect, then from the Togo number prefix. */
export function fedapayChannel(phone: string | null, channel?: string | null): 'moov_tg' | 'togocel' {
  const stored = (channel ?? '').trim().toLowerCase();
  if (stored.includes('moov')) return 'moov_tg';
  if (stored.includes('togo') || stored.includes('mixx')) return 'togocel';
  const national = (phone ?? '').replace(/\D/g, '').replace(/^228/, '');
  return MOOV_PREFIXES.some((prefix) => national.startsWith(prefix)) ? 'moov_tg' : 'togocel';
}

export const REFUND_ATTEMPT_LIMIT = 5;
const REFUND_BACKOFF_MINUTES = [1, 5, 15, 60, 360];

const SLOW_POLL_MS = 24 * 60 * 60_000;

/** Past the send limit the cron still polls, once a day. Earlier attempts wait. */
export function nextRefundAt(attempts: number, now = Date.now()): string {
  if (attempts >= REFUND_ATTEMPT_LIMIT) return new Date(now + SLOW_POLL_MS).toISOString();
  const minutes = REFUND_BACKOFF_MINUTES[Math.max(0, attempts - 1)] ?? 360;
  return new Date(now + minutes * 60_000).toISOString();
}

export function cardReleaseNeedsRefund(message?: string | null): boolean {
  return (message ?? '').toLowerCase().includes('use refund');
}

/** A claim older than this may be taken by another worker. */
export const REFUND_CLAIM_STALE_MS = 2 * 60 * 1000;

export function claimStaleAt(now = Date.now()): string {
  return new Date(now - REFUND_CLAIM_STALE_MS).toISOString();
}

/** One provider reference per booking refund. Retries send this same id. */
export function stableRefundReference(bookingId: string): string {
  const hex = createHash('sha256').update(`rental-decline:${bookingId}`).digest('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), `4${hex.slice(13, 16)}`, `a${hex.slice(17, 20)}`, hex.slice(20, 32)].join('-');
}
