import type { ClientRentalRequestRow } from '../hooks/useRentalApi';

export function formatRentalRequestLocalDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function parseRentalPricingSnapshot(
  snap: unknown
): { total: number; currency: string } | null {
  if (!snap || typeof snap !== 'object') return null;
  const o = snap as Record<string, unknown>;
  const total = o.total;
  const currency = o.currency;
  if (typeof total !== 'number' || typeof currency !== 'string') return null;
  return { total, currency };
}

export function formatRentalMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'XAF',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function proposedContractDeadlineIso(row: ClientRentalRequestRow): string | null {
  const b = row.rental_booking;
  if (b?.status !== 'proposed' || !b.contract_expires_at) return null;
  return b.contract_expires_at;
}
