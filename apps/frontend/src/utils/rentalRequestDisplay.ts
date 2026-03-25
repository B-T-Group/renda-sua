import type { ClientRentalRequestRow, RentalPricingSnapshotLine } from '../hooks/useRentalApi';

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

export type ParsedRentalPricingSnapshot = {
  total: number;
  currency: string;
  lines?: RentalPricingSnapshotLine[];
};

function isPricingLine(raw: unknown): raw is RentalPricingSnapshotLine {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'all_day') {
    return (
      typeof o.calendarDate === 'string' &&
      typeof o.ratePerDay === 'number' &&
      typeof o.subtotal === 'number'
    );
  }
  if (o.kind === 'hourly') {
    return (
      typeof o.startAt === 'string' &&
      typeof o.endAt === 'string' &&
      typeof o.billableHours === 'number' &&
      typeof o.ratePerHour === 'number' &&
      typeof o.subtotal === 'number'
    );
  }
  return false;
}

export function parseRentalPricingSnapshot(snap: unknown): ParsedRentalPricingSnapshot | null {
  if (!snap || typeof snap !== 'object') return null;
  const o = snap as Record<string, unknown>;
  const total = o.total;
  const currency = o.currency;
  if (typeof total !== 'number' || typeof currency !== 'string') return null;
  let lines: RentalPricingSnapshotLine[] | undefined;
  if (Array.isArray(o.lines)) {
    const parsed = o.lines.filter(isPricingLine);
    if (parsed.length) lines = parsed;
  }
  return { total, currency, lines };
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
