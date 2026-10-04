import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface ScheduleObjectives {
  targetAgentRecruitments?: number | null;
  targetClientSignups?: number | null;
  targetMerchantRecruitments?: number | null;
  targetItemSalesAmount?: number | null;
  targetRentalAmount?: number | null;
}

export type ObjectiveKey =
  | 'itemSales'
  | 'rentals'
  | 'clientSignups'
  | 'merchantRecruitments'
  | 'agentRecruitments';

/** Lowest unfinished percent wins. Equal percents keep this order. */
export const OBJECTIVE_TIE_ORDER: ObjectiveKey[] = [
  'itemSales',
  'rentals',
  'clientSignups',
  'merchantRecruitments',
  'agentRecruitments',
];

export interface ObjectiveMetric {
  actual: number;
  target: number | null;
  percent: number | null;
}

export interface ObjectiveActuals {
  agentRecruitments: number;
  clientSignups: number;
  merchantRecruitments: number;
  itemSales: number;
  rentals: number;
}

export interface ObjectiveProgress {
  agentRecruitments: ObjectiveMetric;
  clientSignups: ObjectiveMetric;
  merchantRecruitments: ObjectiveMetric;
  itemSales: ObjectiveMetric;
  rentals: ObjectiveMetric;
  /** Sales-only completion when a sales target is set; otherwise null. */
  completionPercent: number | null;
  /** Unweighted mean of objectives that have a target. */
  overallPercent: number | null;
  /** Unfinished objective furthest behind, or null when every target is met. */
  nextObjective: ObjectiveKey | null;
}

export function salesCompletionPercent(
  actual: number,
  target: number | null | undefined
): number | null {
  if (target == null || target <= 0) return null;
  return Math.min(100, Math.round((actual / target) * 100));
}

export function buildObjectiveProgress(
  actuals: ObjectiveActuals,
  targets: ScheduleObjectives
): ObjectiveProgress {
  const metrics = objectiveMetrics(actuals, targets);
  return {
    ...metrics,
    completionPercent: metrics.itemSales.percent,
    overallPercent: overallObjectivePercent(metrics),
    nextObjective: nextObjectiveKey(metrics),
  };
}

export function overallObjectivePercent(
  metrics: Record<ObjectiveKey, ObjectiveMetric>
): number | null {
  const values = OBJECTIVE_TIE_ORDER.map((key) => metrics[key].percent).filter(
    (value): value is number => value != null
  );
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

export function nextObjectiveKey(
  metrics: Record<ObjectiveKey, ObjectiveMetric>
): ObjectiveKey | null {
  let chosen: ObjectiveKey | null = null;
  let lowest = 100;
  for (const key of OBJECTIVE_TIE_ORDER) {
    const percent = metrics[key].percent;
    if (percent == null || percent >= 100) continue;
    if (chosen != null && percent >= lowest) continue;
    chosen = key;
    lowest = percent;
  }
  return chosen;
}

export function focusRank(progress: ObjectiveProgress): number {
  if (!progress.nextObjective) return 100;
  return progress[progress.nextObjective].percent ?? 100;
}

export function pickFeaturedProgress<T extends { progress: ObjectiveProgress }>(
  rows: T[]
): { featured: T | null; otherCount: number } {
  if (!rows.length) return { featured: null, otherCount: 0 };
  let featured = rows[0];
  for (const row of rows) {
    if (focusRank(row.progress) < focusRank(featured.progress)) featured = row;
  }
  return { featured, otherCount: rows.length - 1 };
}

function objectiveMetrics(actuals: ObjectiveActuals, targets: ScheduleObjectives) {
  return {
    itemSales: metric(actuals.itemSales, targets.targetItemSalesAmount),
    rentals: metric(actuals.rentals, targets.targetRentalAmount),
    clientSignups: metric(actuals.clientSignups, targets.targetClientSignups),
    merchantRecruitments: metric(
      actuals.merchantRecruitments,
      targets.targetMerchantRecruitments
    ),
    agentRecruitments: metric(
      actuals.agentRecruitments,
      targets.targetAgentRecruitments
    ),
  };
}

function metric(actual: number, target?: number | null): ObjectiveMetric {
  const normalized = target ?? null;
  return {
    actual,
    target: normalized,
    percent: salesCompletionPercent(actual, normalized),
  };
}

export function progressWindow(
  startsAt: string,
  acceptedAt: string | null | undefined,
  endsAt: string | null | undefined,
  now = new Date()
): { from: string; to: string } {
  const startMs = new Date(startsAt).getTime();
  const acceptedMs = acceptedAt ? new Date(acceptedAt).getTime() : startMs;
  const from = new Date(Math.max(startMs, acceptedMs)).toISOString();
  const endMs = endsAt ? new Date(endsAt).getTime() : now.getTime();
  const to = new Date(Math.min(endMs, now.getTime())).toISOString();
  return { from, to };
}

@Injectable()
export class PaymentScheduleProgressService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async compute(params: {
    agentId: string;
    agentUserId: string;
    currency: string;
    startsAt: string;
    acceptedAt?: string | null;
    endsAt?: string | null;
    targets: ScheduleObjectives;
  }): Promise<ObjectiveProgress> {
    if (!params.acceptedAt) {
      return emptyProgress(params.targets);
    }
    const { from, to } = progressWindow(
      params.startsAt,
      params.acceptedAt,
      params.endsAt
    );
    if (new Date(from).getTime() >= new Date(to).getTime()) {
      return emptyProgress(params.targets);
    }
    const counts = await this.loadCounts({
      agentId: params.agentId,
      agentUserId: params.agentUserId,
      currency: params.currency,
      from,
      to,
    });
    return buildObjectiveProgress(counts, params.targets);
  }

  private async loadCounts(params: {
    agentId: string;
    agentUserId: string;
    currency: string;
    from: string;
    to: string;
  }) {
    const result = await this.hasura.executeQuery(PROGRESS_COUNTS, {
      agentId: params.agentId,
      agentUserId: params.agentUserId,
      currency: params.currency,
      currencyText: params.currency,
      from: params.from,
      to: params.to,
    });
    const clientOrders = sumUniqueAmounts(
      result.client_orders ?? [],
      (row: OrderRow) => row.id,
      (row: OrderRow) => Number(row.subtotal)
    );
    const merchantOrders = sumUniqueAmounts(
      result.merchant_orders ?? [],
      (row: OrderRow) => row.id,
      (row: OrderRow) => Number(row.subtotal),
      new Set((result.client_orders ?? []).map((row: OrderRow) => row.id))
    );
    const clientRentals = sumUniqueAmounts(
      result.client_rentals ?? [],
      (row: RentalRow) => row.id,
      (row: RentalRow) => Number(row.total_amount)
    );
    const merchantRentals = sumUniqueAmounts(
      result.merchant_rentals ?? [],
      (row: RentalRow) => row.id,
      (row: RentalRow) => Number(row.total_amount),
      new Set((result.client_rentals ?? []).map((row: RentalRow) => row.id))
    );
    return {
      agentRecruitments: Number(
        result.agent_recruits?.aggregate?.count ?? 0
      ),
      clientSignups: Number(result.client_signups?.aggregate?.count ?? 0),
      merchantRecruitments: Number(
        result.merchant_recruits?.aggregate?.count ?? 0
      ),
      itemSales: clientOrders + merchantOrders,
      rentals: clientRentals + merchantRentals,
    };
  }
}

function emptyProgress(targets: ScheduleObjectives): ObjectiveProgress {
  return buildObjectiveProgress(
    {
      agentRecruitments: 0,
      clientSignups: 0,
      merchantRecruitments: 0,
      itemSales: 0,
      rentals: 0,
    },
    targets
  );
}

export function sumUniqueAmounts<T>(
  rows: T[],
  idOf: (row: T) => string,
  amountOf: (row: T) => number,
  excludeIds?: Set<string>
): number {
  const seen = new Set<string>(excludeIds ? [...excludeIds] : []);
  let total = 0;
  for (const row of rows) {
    const id = idOf(row);
    if (seen.has(id)) continue;
    seen.add(id);
    const amount = amountOf(row);
    if (Number.isFinite(amount)) total += amount;
  }
  return total;
}

interface OrderRow {
  id: string;
  subtotal: number;
}

interface RentalRow {
  id: string;
  total_amount: number;
}

const PROGRESS_COUNTS = `
  query ScheduleProgress(
    $agentId: uuid!
    $agentUserId: uuid!
    $currency: currency_enum!
    $currencyText: String!
    $from: timestamptz!
    $to: timestamptz!
  ) {
    agent_recruits: agents_aggregate(where: {
      referred_by_agent_id: { _eq: $agentId }
      created_at: { _gte: $from, _lte: $to }
    }) { aggregate { count } }
    client_signups: clients_aggregate(where: {
      referred_by_user_id: { _eq: $agentUserId }
      created_at: { _gte: $from, _lte: $to }
    }) { aggregate { count } }
    merchant_recruits: businesses_aggregate(where: {
      referred_by_agent_id: { _eq: $agentId }
      created_at: { _gte: $from, _lte: $to }
    }) { aggregate { count } }
    client_orders: orders(where: {
      currency: { _eq: $currencyText }
      current_status: { _in: [complete, delivered] }
      completed_at: { _gte: $from, _lte: $to }
      client: { referred_by_user_id: { _eq: $agentUserId } }
    }) { id subtotal }
    merchant_orders: orders(where: {
      currency: { _eq: $currencyText }
      current_status: { _in: [complete, delivered] }
      completed_at: { _gte: $from, _lte: $to }
      business: { referred_by_agent_id: { _eq: $agentId } }
    }) { id subtotal }
    client_rentals: rental_bookings(where: {
      currency: { _eq: $currency }
      status: { _in: [confirmed, active, awaiting_return, completed] }
      created_at: { _gte: $from, _lte: $to }
      client: { referred_by_user_id: { _eq: $agentUserId } }
    }) { id total_amount }
    merchant_rentals: rental_bookings(where: {
      currency: { _eq: $currency }
      status: { _in: [confirmed, active, awaiting_return, completed] }
      created_at: { _gte: $from, _lte: $to }
      business: { referred_by_agent_id: { _eq: $agentId } }
    }) { id total_amount }
  }
`;
