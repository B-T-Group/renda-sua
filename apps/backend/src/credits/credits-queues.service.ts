import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  CREDIT_FEEDBACK_WINDOW_DAYS,
  CREDIT_WEIGHTS,
} from './credit-weights';
import type {
  CreditEventType,
  CreditsFeedbackOrderRow,
  CreditsOrderItemBrief,
  UserCreditRow,
} from './credit.types';

export interface CreditsLedgerQuery {
  limit: number;
  offset: number;
  userId?: string;
  eventType?: CreditEventType;
  country?: string;
}

export interface CreditsSummaryQuery {
  limit: number;
  offset: number;
  eventType?: CreditEventType;
  country?: string;
}

export interface CreditsQueueParams {
  limit: number;
  offset: number;
  country?: string;
}

interface CreditsSummaryUser {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  country: string | null;
  agent: { id: string } | null;
  business: { id: string } | null;
}

const ORDER_ITEM_FIELDS = `
  item_name quantity variant_name
  item {
    item_images(order_by: { display_order: asc }, limit: 1) {
      image_url display_url
    }
  }
  item_variant {
    item_variant_images(order_by: [{ is_primary: desc }, { display_order: asc }], limit: 1) {
      image_url
    }
  }
`;

type RawOrderItem = {
  item_name: string | null;
  quantity: number;
  variant_name: string | null;
  item?: {
    item_images?: Array<{ image_url?: string | null; display_url?: string | null }>;
  } | null;
  item_variant?: {
    item_variant_images?: Array<{ image_url?: string | null }>;
  } | null;
};

type RawFeedbackOrder = Omit<CreditsFeedbackOrderRow, 'order_items'> & {
  order_items?: RawOrderItem[] | null;
};

@Injectable()
export class CreditsQueuesService {
  constructor(private readonly hasura: HasuraSystemService) {}

  feedbackCutoffIso(): string {
    const d = new Date();
    d.setDate(d.getDate() - CREDIT_FEEDBACK_WINDOW_DAYS);
    return d.toISOString();
  }

  async listCredits(query: CreditsLedgerQuery): Promise<{
    items: UserCreditRow[];
    total: number;
  }> {
    const where = this.buildCreditWhere(query);
    const res = await this.hasura.executeQuery<{
      user_credits: UserCreditRow[];
      user_credits_aggregate: { aggregate: { count: number } | null };
    }>(
      `query ListUserCredits(
        $where: user_credits_bool_exp!
        $limit: Int!
        $offset: Int!
      ) {
        user_credits(
          where: $where
          order_by: { created_at: desc }
          limit: $limit
          offset: $offset
        ) {
          id user_id event_type weight order_id order_risk_incident_id
          referred_business_id referred_agent_id contact_channel order_result
          notes created_at created_by
        }
        user_credits_aggregate(where: $where) {
          aggregate { count }
        }
      }`,
      {
        where,
        limit: Number(query.limit),
        offset: Number(query.offset),
      }
    );
    return {
      items: res.user_credits ?? [],
      total: res.user_credits_aggregate?.aggregate?.count ?? 0,
    };
  }

  async listSummary(query: CreditsSummaryQuery): Promise<{
    items: Array<{
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      country: string | null;
      total_weight: number;
      credit_count: number;
      by_event: Record<string, { count: number; weight: number }>;
      is_agent: boolean;
      is_business: boolean;
    }>;
    total: number;
    weights: Record<CreditEventType, number>;
  }> {
    const where = this.buildCreditWhere({
      eventType: query.eventType,
      country: query.country,
    });
    const res = await this.hasura.executeQuery<{
      user_credits: Array<{
        user_id: string;
        event_type: CreditEventType;
        weight: number;
        user: CreditsSummaryUser | null;
      }>;
    }>(
      `query CreditsSummary($where: user_credits_bool_exp!) {
        user_credits(where: $where, order_by: { created_at: desc }, limit: 5000) {
          user_id event_type weight
          user {
            first_name last_name email country
            agent { id }
            business { id }
          }
        }
      }`,
      { where }
    );
    const map = this.aggregateByUser(res.user_credits ?? []);
    const sorted = [...map.values()].sort(
      (a, b) => b.total_weight - a.total_weight
    );
    const offset = Number(query.offset);
    const limit = Number(query.limit);
    return {
      items: sorted.slice(offset, offset + limit),
      total: sorted.length,
      weights: { ...CREDIT_WEIGHTS },
    };
  }

  async listOpenEscalations(
    params: CreditsQueueParams
  ): Promise<{ items: unknown[]; total: number }> {
    const where = {
      resolved_at: { _is_null: true },
      ...this.orderClientCountryFilter(params.country),
    };
    const res = await this.hasura.executeQuery<{
      order_risk_incidents: unknown[];
      order_risk_incidents_aggregate: {
        aggregate: { count: number } | null;
      };
    }>(
      `query OpenEscalations(
        $where: order_risk_incidents_bool_exp!
        $limit: Int!
        $offset: Int!
      ) {
        order_risk_incidents(
          where: $where
          order_by: [{ severity: desc }, { detected_at: asc }]
          limit: $limit
          offset: $offset
        ) {
          id order_id risk_type severity detected_at overdue_minutes
          acknowledged_at
          order {
            id order_number current_status fulfillment_method
            client {
              user { first_name last_name phone_number email country }
            }
            business {
              name
              user { first_name last_name phone_number }
            }
            order_items(limit: 10) { ${ORDER_ITEM_FIELDS} }
          }
        }
        order_risk_incidents_aggregate(where: $where) {
          aggregate { count }
        }
      }`,
      {
        where,
        limit: Number(params.limit),
        offset: Number(params.offset),
      }
    );
    return {
      items: res.order_risk_incidents ?? [],
      total: res.order_risk_incidents_aggregate?.aggregate?.count ?? 0,
    };
  }

  async listCancelledWithoutFeedback(
    params: CreditsQueueParams
  ): Promise<{ items: CreditsFeedbackOrderRow[]; total: number }> {
    const cutoff = this.feedbackCutoffIso();
    const where = {
      current_status: { _eq: 'cancelled' },
      cancelled_at: { _gte: cutoff },
      ops_classification: { _is_null: true },
      _not: {
        user_credits: { event_type: { _eq: 'cancelled_feedback' } },
      },
      ...this.clientCountryFilter(params.country),
    };
    return this.listOrdersQueue(where, params);
  }

  async listFirstOrderWithoutFeedback(
    params: CreditsQueueParams
  ): Promise<{ items: CreditsFeedbackOrderRow[]; total: number }> {
    const cutoff = this.feedbackCutoffIso();
    const where = {
      current_status: { _eq: 'complete' },
      completed_at: { _gte: cutoff },
      ops_classification: { _is_null: true },
      _not: {
        user_credits: {
          event_type: { _eq: 'first_order_completed_feedback' },
        },
      },
      ...this.clientCountryFilter(params.country),
    };
    // Scan the full 14-day candidate set (ops-scale), then filter to true
    // first completions before applying page limit/offset.
    const candidateLimit = 5000;
    const res = await this.hasura.executeQuery<{
      orders: RawFeedbackOrder[];
    }>(
      `query FirstOrderCandidates(
        $where: orders_bool_exp!
        $limit: Int!
      ) {
        orders(
          where: $where
          order_by: { completed_at: asc_nulls_last }
          limit: $limit
        ) {
          id order_number client_id current_status fulfillment_method
          completed_at cancellation_notes
          client {
            user_id
            user { first_name last_name phone_number email country }
          }
          business { name }
          order_items(limit: 10) { ${ORDER_ITEM_FIELDS} }
        }
      }`,
      { where, limit: candidateLimit }
    );
    const firsts = await this.filterFirstCompletedOrders(
      (res.orders ?? []).map((o) => this.mapFeedbackOrder(o))
    );
    const offset = Number(params.offset);
    const limit = Number(params.limit);
    return {
      items: firsts.slice(offset, offset + limit),
      total: firsts.length,
    };
  }

  async getOrderForFeedback(orderId: string): Promise<{
    id: string;
    current_status: string;
    cancelled_at: string | null;
    completed_at: string | null;
    updated_at: string;
    client_id: string;
    ops_classification: 'test' | 'internal' | null;
    client_user_id: string | null;
  } | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: {
        id: string;
        current_status: string;
        cancelled_at: string | null;
        completed_at: string | null;
        updated_at: string;
        client_id: string;
        ops_classification: 'test' | 'internal' | null;
        client: { user_id: string } | null;
      } | null;
    }>(
      `query OrderForCreditFeedback($id: uuid!) {
        orders_by_pk(id: $id) {
          id current_status cancelled_at completed_at updated_at client_id
          ops_classification
          client { user_id }
        }
      }`,
      { id: orderId }
    );
    const row = res.orders_by_pk;
    if (!row) return null;
    return {
      id: row.id,
      current_status: row.current_status,
      cancelled_at: row.cancelled_at,
      completed_at: row.completed_at,
      updated_at: row.updated_at,
      client_id: row.client_id,
      ops_classification: row.ops_classification,
      client_user_id: row.client?.user_id ?? null,
    };
  }

  async isWithinFeedbackWindow(iso: string | null | undefined): Promise<boolean> {
    if (!iso) return false;
    return new Date(iso).getTime() >= new Date(this.feedbackCutoffIso()).getTime();
  }

  async isClientFirstCompletedOrder(
    clientId: string,
    orderId: string
  ): Promise<boolean> {
    const res = await this.hasura.executeQuery<{
      orders: Array<{ id: string }>;
    }>(
      `query FirstCompletedOrder($clientId: uuid!) {
        orders(
          where: {
            client_id: { _eq: $clientId }
            current_status: { _eq: "complete" }
            completed_at: { _is_null: false }
          }
          order_by: { completed_at: asc_nulls_last }
          limit: 1
        ) { id }
      }`,
      { clientId }
    );
    return res.orders?.[0]?.id === orderId;
  }

  private async listOrdersQueue(
    where: Record<string, unknown>,
    params: { limit: number; offset: number }
  ): Promise<{ items: CreditsFeedbackOrderRow[]; total: number }> {
    const res = await this.hasura.executeQuery<{
      orders: RawFeedbackOrder[];
      orders_aggregate: { aggregate: { count: number } | null };
    }>(
      `query CreditOrdersQueue(
        $where: orders_bool_exp!
        $limit: Int!
        $offset: Int!
      ) {
        orders(
          where: $where
          order_by: { updated_at: desc }
          limit: $limit
          offset: $offset
        ) {
          id order_number current_status fulfillment_method
          cancelled_at completed_at cancellation_notes updated_at client_id
          client {
            user_id
            user { first_name last_name phone_number email country }
          }
          business { name }
          order_items(limit: 10) { ${ORDER_ITEM_FIELDS} }
        }
        orders_aggregate(where: $where) {
          aggregate { count }
        }
      }`,
      {
        where,
        limit: Number(params.limit),
        offset: Number(params.offset),
      }
    );
    return {
      items: (res.orders ?? []).map((o) => this.mapFeedbackOrder(o)),
      total: res.orders_aggregate?.aggregate?.count ?? 0,
    };
  }

  private mapFeedbackOrder(order: RawFeedbackOrder): CreditsFeedbackOrderRow {
    return {
      ...order,
      order_items: (order.order_items ?? []).map((item) =>
        this.mapOrderItem(item)
      ),
    };
  }

  private mapOrderItem(item: RawOrderItem): CreditsOrderItemBrief {
    const variantImg =
      item.item_variant?.item_variant_images?.[0]?.image_url ?? null;
    const itemImg =
      item.item?.item_images?.[0]?.display_url ||
      item.item?.item_images?.[0]?.image_url ||
      null;
    return {
      item_name: item.item_name,
      quantity: item.quantity,
      variant_name: item.variant_name,
      image_url: variantImg || itemImg,
    };
  }

  private async filterFirstCompletedOrders(
    orders: CreditsFeedbackOrderRow[]
  ): Promise<CreditsFeedbackOrderRow[]> {
    // Caller must pass candidates ordered by completed_at asc so the first
    // row per client is their earliest in-window completion.
    const seen = new Set<string>();
    const out: CreditsFeedbackOrderRow[] = [];
    for (const order of orders) {
      const clientId = order.client_id;
      if (!clientId || seen.has(clientId)) continue;
      seen.add(clientId);
      const isFirst = await this.isClientFirstCompletedOrder(
        clientId,
        order.id
      );
      if (isFirst) out.push(order);
    }
    return out;
  }

  private normalizeCountry(country?: string): string | null {
    const code = country?.trim().toUpperCase();
    return code && /^[A-Z]{2}$/.test(code) ? code : null;
  }

  private clientCountryFilter(country?: string): Record<string, unknown> {
    const code = this.normalizeCountry(country);
    if (!code) return {};
    return { client: { user: { country: { _eq: code } } } };
  }

  private orderClientCountryFilter(country?: string): Record<string, unknown> {
    const code = this.normalizeCountry(country);
    if (!code) return {};
    return { order: { client: { user: { country: { _eq: code } } } } };
  }

  private buildCreditWhere(query: {
    userId?: string;
    eventType?: CreditEventType;
    country?: string;
  }): Record<string, unknown> {
    const parts: Record<string, unknown>[] = [];
    if (query.userId) parts.push({ user_id: { _eq: query.userId } });
    if (query.eventType) parts.push({ event_type: { _eq: query.eventType } });
    const code = this.normalizeCountry(query.country);
    if (code) parts.push({ user: { country: { _eq: code } } });
    if (!parts.length) return {};
    return parts.length === 1 ? parts[0] : { _and: parts };
  }

  private aggregateByUser(
    rows: Array<{
      user_id: string;
      event_type: CreditEventType;
      weight: number;
      user: CreditsSummaryUser | null;
    }>
  ) {
    const map = new Map<
      string,
      {
        user_id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        country: string | null;
        total_weight: number;
        credit_count: number;
        by_event: Record<string, { count: number; weight: number }>;
        is_agent: boolean;
        is_business: boolean;
      }
    >();
    for (const row of rows) {
      let entry = map.get(row.user_id);
      if (!entry) {
        entry = {
          user_id: row.user_id,
          first_name: row.user?.first_name ?? null,
          last_name: row.user?.last_name ?? null,
          email: row.user?.email ?? null,
          country: row.user?.country ?? null,
          total_weight: 0,
          credit_count: 0,
          by_event: {},
          is_agent: !!row.user?.agent,
          is_business: !!row.user?.business,
        };
        map.set(row.user_id, entry);
      }
      entry.total_weight += row.weight;
      entry.credit_count += 1;
      const bucket = entry.by_event[row.event_type] ?? { count: 0, weight: 0 };
      bucket.count += 1;
      bucket.weight += row.weight;
      entry.by_event[row.event_type] = bucket;
    }
    return map;
  }
}
