import type { ExpiryCountryFilter } from './rental-dashboard-flag';
import {
  earliestRequestStartIso,
  effectiveRespondBy,
  type RentalRespondWindow,
} from './rental-respond-by';

export interface UnansweredRentalRequest {
  id: string;
  created_at: string;
  respond_by?: string | null;
  requested_start_at?: string | null;
  rental_selection_windows?: unknown;
  clientUserId: string | null;
  businessUserId: string | null;
  itemName: string;
  businessName: string;
  renterName: string;
  listingId: string;
}

export interface SideEffectJob {
  id: string;
  kind: 'release' | 'notify';
  row: UnansweredRentalRequest;
  window: RentalRespondWindow;
}

export interface ExpireUnansweredDeps {
  now: Date;
  isEnabled: () => Promise<boolean>;
  listPending: () => Promise<UnansweredRentalRequest[]>;
  casDecline: (id: string, respondedAt: string) => Promise<boolean>;
  releaseHolds: (requestId: string) => Promise<void>;
  notify: (row: UnansweredRentalRequest, window: RentalRespondWindow) => Promise<void>;
  listRetries?: () => Promise<SideEffectJob[]>;
  clearRetry?: (id: string) => Promise<void>;
  recordFailure?: (
    row: UnansweredRentalRequest,
    kind: 'release' | 'notify',
    window: RentalRespondWindow,
    error: unknown
  ) => Promise<void>;
}

export interface AutodeclineConfigRow {
  config_key: string;
  country_code: string | null;
  string_value?: string | null;
  number_value?: number | null;
}

/** No stored cutoff means nothing already due (older than now) is touched. */
export function autodeclineBounds(
  now: Date,
  rows: AutodeclineConfigRow[]
): { since: string; limit: number } {
  return { since: earliestCutoff(now, sinceRows(rows)), limit: autodeclineBatch(rows) };
}

export function cutoffForCountry(rows: AutodeclineConfigRow[], country: string | null, now: Date): string {
  const code = (country ?? '').trim().toUpperCase();
  const match = sinceRows(rows).find((row) => (row.country_code ?? '').toUpperCase() === code);
  if (code && match?.string_value) return match.string_value;
  const global = sinceRows(rows).find((row) => row.country_code == null);
  return global?.string_value || now.toISOString();
}

function sinceRows(rows: AutodeclineConfigRow[]): AutodeclineConfigRow[] {
  return rows.filter((row) => row.config_key === 'rentals_dashboard_requests_autodecline_since');
}

function earliestCutoff(now: Date, rows: AutodeclineConfigRow[]): string {
  const stamps = rows.map((row) => row.string_value).filter((value): value is string => !!value);
  if (!stamps.length) return now.toISOString();
  return stamps.reduce((earliest, value) => (Date.parse(value) < Date.parse(earliest) ? value : earliest));
}

export function pendingExpiryWhere(
  now: Date,
  since: string,
  filter: ExpiryCountryFilter
): Record<string, unknown> | null {
  if (filter.kind === 'none') return null;
  const where: Record<string, unknown> = {
    status: { _eq: 'pending' },
    respond_by: { _lte: now.toISOString(), _gte: since },
  };
  if (filter.kind === 'in') {
    where.rental_location_listing = addressCountry({ _in: filter.countries });
  }
  if (filter.kind === 'out') {
    where.rental_location_listing = addressCountry({ _nin: filter.countries });
  }
  return where;
}

function addressCountry(country: Record<string, unknown>): Record<string, unknown> {
  return { business_location: { address: { country } } };
}

function autodeclineBatch(rows: AutodeclineConfigRow[]): number {
  const row = rows.find((item) => item.config_key === 'rentals_dashboard_requests_autodecline_batch');
  const batch = Number(row?.number_value);
  if (!Number.isFinite(batch) || batch < 1) return 50;
  return Math.min(500, Math.floor(batch));
}

/** Decline pending requests past respond_by. A lost compare-and-set skips side effects. */
export async function expireUnansweredRentalRequests(deps: ExpireUnansweredDeps): Promise<number> {
  if (!(await deps.isEnabled())) return 0;
  await retrySideEffects(deps);
  const rows = await deps.listPending();
  let expired = 0;
  for (const row of rows) {
    if (await expireOneUnanswered(deps, row)) expired += 1;
  }
  return expired;
}

async function retrySideEffects(deps: ExpireUnansweredDeps): Promise<void> {
  if (!deps.listRetries) return;
  for (const job of await deps.listRetries()) {
    await retryOne(deps, job);
  }
}

async function retryOne(deps: ExpireUnansweredDeps, job: SideEffectJob): Promise<void> {
  try {
    if (job.kind === 'release') await deps.releaseHolds(job.row.id);
    else await deps.notify(job.row, job.window);
    await deps.clearRetry?.(job.id);
  } catch (error: any) {
    await deps.recordFailure?.(job.row, job.kind, job.window, error);
  }
}

async function expireOneUnanswered(
  deps: ExpireUnansweredDeps,
  row: UnansweredRentalRequest
): Promise<boolean> {
  const decision = effectiveRespondBy({
    createdAt: row.created_at,
    respondBy: row.respond_by,
    startAt: earliestRequestStartIso(row),
  });
  if (Date.parse(decision.respondBy) > deps.now.getTime()) return false;
  const won = await deps.casDecline(row.id, deps.now.toISOString());
  if (!won) return false;
  await releaseThenNotify(deps, row, decision.window);
  return true;
}

async function releaseThenNotify(
  deps: ExpireUnansweredDeps,
  row: UnansweredRentalRequest,
  window: RentalRespondWindow
): Promise<void> {
  await runSideEffect(deps, row, 'release', window, () => deps.releaseHolds(row.id));
  await runSideEffect(deps, row, 'notify', window, () => deps.notify(row, window));
}

async function runSideEffect(
  deps: ExpireUnansweredDeps,
  row: UnansweredRentalRequest,
  kind: 'release' | 'notify',
  window: RentalRespondWindow,
  work: () => Promise<void>
): Promise<void> {
  try {
    await work();
  } catch (error: any) {
    await deps.recordFailure?.(row, kind, window, error);
  }
}
