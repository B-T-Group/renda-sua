import { addDays, doualaMidnight } from './douala-period';
import type { StoredCommissionGrid } from './representative-commission-grid.service';

export function fastStartAmountDue(
  signedAt: string,
  period: { start: string; end: string }
): boolean {
  const day90 = addDays(new Date(signedAt), 89);
  return day90 >= doualaMidnight(period.start) && day90 < doualaMidnight(period.end);
}

export function activationSubjectIds(
  businesses: ActivationBusiness[],
  period: { start: string; end: string },
  grid: Pick<StoredCommissionGrid, 'activationMinSales' | 'activationWindowDays'>,
  agentUserId: string | null,
  alreadyPaid: Set<string>
): string[] {
  return businesses
    .filter((business) => activationInPeriod(business, period, grid, agentUserId, alreadyPaid))
    .map((business) => business.id);
}

export function countActivations(
  businesses: ActivationBusiness[],
  period: { start: string; end: string },
  grid: Pick<StoredCommissionGrid, 'activationMinSales' | 'activationWindowDays'>,
  agentUserId: string | null,
  alreadyPaid: Set<string>
): number {
  return activationSubjectIds(businesses, period, grid, agentUserId, alreadyPaid).length;
}

function activationInPeriod(
  business: ActivationBusiness,
  period: { start: string; end: string },
  grid: Pick<StoredCommissionGrid, 'activationMinSales' | 'activationWindowDays'>,
  agentUserId: string | null,
  alreadyPaid: Set<string>
): boolean {
  if (alreadyPaid.has(business.id) || !business.merchant_agreement_accepted_at) return false;
  const crossed = crossingAt(business, grid, agentUserId);
  if (!crossed) return false;
  const start = doualaMidnight(period.start).getTime();
  const end = doualaMidnight(period.end).getTime();
  return crossed >= start && crossed < end;
}

function crossingAt(
  business: ActivationBusiness,
  grid: Pick<StoredCommissionGrid, 'activationMinSales' | 'activationWindowDays'>,
  agentUserId: string | null
): number | null {
  const accepted = Date.parse(business.merchant_agreement_accepted_at ?? '');
  const windowEnd = addDays(new Date(accepted), grid.activationWindowDays).getTime();
  let total = 0;
  const sales = [...(business.orders ?? [])].sort(byCompleted);
  for (const sale of sales) {
    if (!countsTowardActivation(sale, accepted, windowEnd, agentUserId)) continue;
    total += Number(sale.subtotal ?? 0);
    if (total >= grid.activationMinSales) return Date.parse(sale.completed_at ?? '');
  }
  return null;
}

function countsTowardActivation(
  sale: ActivationOrder,
  accepted: number,
  windowEnd: number,
  agentUserId: string | null
): boolean {
  const at = Date.parse(sale.completed_at ?? '');
  if (at < accepted || at > windowEnd) return false;
  return sale.client?.user_id == null || sale.client.user_id !== agentUserId;
}

function byCompleted(a: ActivationOrder, b: ActivationOrder): number {
  return Date.parse(a.completed_at ?? '') - Date.parse(b.completed_at ?? '');
}

export interface ActivationOrder {
  subtotal?: unknown;
  completed_at?: string | null;
  client?: { user_id?: string | null } | null;
}

export interface ActivationBusiness {
  id: string;
  merchant_agreement_accepted_at?: string | null;
  orders?: ActivationOrder[];
}
