import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface ScheduleObjectives {
  targetAgentRecruitments?: number | null;
  targetClientSignups?: number | null;
  targetMerchantRecruitments?: number | null;
  targetItemSalesAmount?: number | null;
  targetRentalAmount?: number | null;
}

export interface ObjectiveProgress {
  agentRecruitments: { actual: number; target: number | null };
  clientSignups: { actual: number; target: number | null };
  merchantRecruitments: { actual: number; target: number | null };
  itemSales: { actual: number; target: number | null };
  rentals: { actual: number; target: number | null };
  /** Sales-only completion when a sales target is set; otherwise null. */
  completionPercent: number | null;
}

export function salesCompletionPercent(
  actual: number,
  target: number | null | undefined
): number | null {
  if (target == null || target <= 0) return null;
  return Math.min(100, Math.round((actual / target) * 100));
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
    return {
      agentRecruitments: {
        actual: counts.agentRecruitments,
        target: params.targets.targetAgentRecruitments ?? null,
      },
      clientSignups: {
        actual: counts.clientSignups,
        target: params.targets.targetClientSignups ?? null,
      },
      merchantRecruitments: {
        actual: counts.merchantRecruitments,
        target: params.targets.targetMerchantRecruitments ?? null,
      },
      itemSales: {
        actual: counts.itemSales,
        target: params.targets.targetItemSalesAmount ?? null,
      },
      rentals: {
        actual: counts.rentals,
        target: params.targets.targetRentalAmount ?? null,
      },
      completionPercent: salesCompletionPercent(
        counts.itemSales,
        params.targets.targetItemSalesAmount
      ),
    };
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
  return {
    agentRecruitments: {
      actual: 0,
      target: targets.targetAgentRecruitments ?? null,
    },
    clientSignups: {
      actual: 0,
      target: targets.targetClientSignups ?? null,
    },
    merchantRecruitments: {
      actual: 0,
      target: targets.targetMerchantRecruitments ?? null,
    },
    itemSales: {
      actual: 0,
      target: targets.targetItemSalesAmount ?? null,
    },
    rentals: {
      actual: 0,
      target: targets.targetRentalAmount ?? null,
    },
    completionPercent: salesCompletionPercent(
      0,
      targets.targetItemSalesAmount
    ),
  };
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
