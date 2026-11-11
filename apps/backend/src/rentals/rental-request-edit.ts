/** Edits close this long before the booking start, same as the request lead time. */
export const RENTAL_EDIT_LEAD_MS = 2 * 60 * 60 * 1000;

export type RentalEditBlock =
  | 'ok'
  | 'not_pending'
  | 'stale_version'
  | 'window_closed'
  | 'unavailable';

export type RentalAcceptBlock = 'ok' | 'missing_version' | 'stale_version' | 'not_pending';

export interface RentalWindowSnapshot {
  start_at: string;
  end_at: string;
  billing?: 'hourly' | 'all_day' | string;
  calendar_date?: string;
}

export interface RentalRequestSnapshot {
  windows: RentalWindowSnapshot[];
  units: number;
  note: string | null;
}

export type RentalChangeField = 'dates' | 'quantity' | 'notes';

export interface RentalChangeSummary {
  fields: RentalChangeField[];
  dates?: { from: RentalWindowSnapshot[]; to: RentalWindowSnapshot[] };
  quantity?: { from: number; to: number };
  notes?: { changed: true };
}

export function editWindowOpen(startIso: string, nowMs: number): boolean {
  const start = new Date(startIso).getTime();
  return Number.isFinite(start) && start > nowMs + RENTAL_EDIT_LEAD_MS;
}

export function classifyRentalEdit(input: {
  status: string;
  version: number;
  expectedVersion: number;
  currentStartIso: string;
  nextStartIso: string;
  nowMs: number;
  unitsFree: boolean;
}): RentalEditBlock {
  if (input.status !== 'pending') return 'not_pending';
  if (input.version !== input.expectedVersion) return 'stale_version';
  if (!editWindowOpen(input.currentStartIso, input.nowMs)) return 'window_closed';
  if (!editWindowOpen(input.nextStartIso, input.nowMs)) return 'window_closed';
  if (!input.unitsFree) return 'unavailable';
  return 'ok';
}

/** A response may commit only the version the business sent. */
export function classifyRentalAccept(input: {
  status: string;
  version: number;
  expectedVersion: number | null;
  requireVersion: boolean;
}): RentalAcceptBlock {
  if (input.requireVersion && input.expectedVersion == null) return 'missing_version';
  if (input.status !== 'pending') return 'not_pending';
  if (input.expectedVersion != null && input.version !== input.expectedVersion) {
    return 'stale_version';
  }
  return 'ok';
}

export function normalizeRequestNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? '';
  return trimmed.length ? trimmed : null;
}

function windowKey(row: RentalWindowSnapshot): string {
  const billing = row.billing === 'all_day' ? 'all_day' : 'hourly';
  const day = row.calendar_date ?? '';
  return `${billing}|${day}|${row.start_at}|${row.end_at}`;
}

export function sameWindows(left: RentalWindowSnapshot[], right: RentalWindowSnapshot[]): boolean {
  if (left.length !== right.length) return false;
  const keys = left.map(windowKey).sort();
  const other = right.map(windowKey).sort();
  return keys.every((key, index) => key === other[index]);
}

export function buildChangeSummary(
  before: RentalRequestSnapshot,
  after: RentalRequestSnapshot
): RentalChangeSummary {
  const fields: RentalChangeField[] = [];
  const summary: RentalChangeSummary = { fields };
  if (!sameWindows(before.windows, after.windows)) {
    fields.push('dates');
    summary.dates = { from: before.windows, to: after.windows };
  }
  if (before.units !== after.units) {
    fields.push('quantity');
    summary.quantity = { from: before.units, to: after.units };
  }
  if (normalizeRequestNote(before.note) !== normalizeRequestNote(after.note)) {
    fields.push('notes');
    summary.notes = { changed: true };
  }
  return summary;
}

export function quotePlanTotal(
  windows: Array<{ billing?: string; start: Date; end: Date }>,
  dayRate: number,
  hourRate: number,
  units: number
): number | null {
  if (!Number.isFinite(dayRate) && !Number.isFinite(hourRate)) return null;
  const day = Number.isFinite(dayRate) ? dayRate : 0;
  const hour = Number.isFinite(hourRate) ? hourRate : 0;
  let total = 0;
  for (const row of windows) {
    if (row.billing === 'all_day') {
      total += day * units;
    } else {
      const hours = Math.max(1, Math.ceil((row.end.getTime() - row.start.getTime()) / 3600000));
      total += hours * hour * units;
    }
  }
  return Number(total.toFixed(2));
}

export function earliestWindowIso(windows: RentalWindowSnapshot[]): string {
  const starts = windows
    .map((row) => new Date(row.start_at).getTime())
    .filter((ms) => Number.isFinite(ms));
  if (!starts.length) return '';
  return new Date(Math.min(...starts)).toISOString();
}
