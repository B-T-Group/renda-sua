import type {
  ClientRentalRequestRow,
  RentalPricingSnapshotLine,
  RentalSelectionWindow,
} from '../hooks/useRentalApi';
import { formatConfirmationMoney } from './rentals/confirmationFormat';

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

export function parseRentalSelectionWindows(raw: unknown): RentalSelectionWindow[] {
  if (!Array.isArray(raw)) return [];
  const windows: RentalSelectionWindow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.start_at !== 'string' || typeof row.end_at !== 'string') continue;
    windows.push({
      start_at: row.start_at,
      end_at: row.end_at,
      billing: row.billing === 'all_day' ? 'all_day' : undefined,
      calendar_date: typeof row.calendar_date === 'string' ? row.calendar_date : undefined,
    });
  }
  return windows.sort(
    (a, b) =>
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
}

export type ParsedRentalPricingSnapshot = {
  total: number;
  currency: string;
  securityDeposit?: number;
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
  const securityDeposit =
    typeof o.securityDeposit === 'number' && o.securityDeposit > 0
      ? o.securityDeposit
      : undefined;
  return { total, currency, securityDeposit, lines };
}

function groupedDigits(amount: number, separator: string): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)}`;
}

/**
 * XAF, XOF, and FCFA use `45 000 FCFA` (non-breaking spaces).
 * CAD uses the shared confirmation formatter: `$65.00` / `65,00 $`.
 */
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

/** CAD matches the other Stripe screens: `$25.00` / `25,00 $`. */
export function formatAssistantMoney(amount: number, currency: string | undefined, locale: string): string {
  if ((currency || '').toUpperCase() === 'CAD') return formatCadAmount(amount, locale);
  const groups = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  const code = currency === 'XAF' || currency === 'XOF' || !currency ? 'FCFA' : currency;
  return `${groups}\u00A0${code}`;
}

function formatCadAmount(amount: number, locale: string): string {
  const tag = locale.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-CA';
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * XAF, XOF, and FCFA use `45 000 FCFA` (non-breaking spaces) in every locale.
 * Other currencies keep the runtime Intl currency format.
 */
export function formatRentalMoney(amount: number, currency: string): string {
  const code = (currency || 'XAF').toUpperCase();
  const iso = code.length === 3 ? code : 'XAF';
  if (iso === 'XAF' || iso === 'XOF' || code === 'FCFA') {
    return `${groupedDigits(Number.isFinite(amount) ? amount : 0, '\u00A0')}\u00A0FCFA`;
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: iso,
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
