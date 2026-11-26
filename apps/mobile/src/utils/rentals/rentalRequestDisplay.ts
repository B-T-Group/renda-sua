import type {
  ClientRentalRequestRow,
  RentalPricingSnapshotLine,
  RentalSelectionWindow,
} from '../../types/rentals';

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
    if (typeof row.start_at !== 'string' || typeof row.end_at !== 'string') {
      continue;
    }
    windows.push({
      start_at: row.start_at,
      end_at: row.end_at,
      billing: row.billing === 'all_day' ? 'all_day' : undefined,
      calendar_date:
        typeof row.calendar_date === 'string' ? row.calendar_date : undefined,
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

export function parseRentalPricingSnapshot(
  snap: unknown
): ParsedRentalPricingSnapshot | null {
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
 * Search cards and date totals. Matches the catalog and request formatters:
 * XAF, XOF, and FCFA use `45 000 FCFA` (non-breaking spaces) in English and French.
 * CAD uses `$45.00` / `45,00 $`.
 */
export function formatSearchMoney(amount: number, currency: string, language: string): string {
  const code = (currency || '').trim().toUpperCase();
  const value = Number.isFinite(amount) ? amount : 0;
  if (code === 'CAD') {
    const digits = value.toFixed(2);
    if (language.toLowerCase().startsWith('fr')) return `${digits.replace('.', ',')}\u00A0$`;
    return `$${digits}`;
  }
  if (code === 'XAF' || code === 'XOF' || code === 'FCFA' || !code) {
    return `${groupedDigits(value, '\u00A0')}\u00A0FCFA`;
  }
  return formatRentalMoney(value, currency);
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

export function proposedContractDeadlineIso(
  row: ClientRentalRequestRow
): string | null {
  const b = row.rental_booking;
  if (b?.status === 'proposed' && b.contract_expires_at) {
    return b.contract_expires_at;
  }
  return row.expires_at?.trim() || null;
}
