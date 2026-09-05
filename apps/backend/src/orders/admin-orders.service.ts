import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DEFAULT_USER_TIMEZONE } from '../users/user-timezone.util';
import {
  computeOrderStatsAverages,
  computeOrderStatsRates,
} from './admin-order-stats.util';
import { mapAdminOrderRow, mapIncidents } from './admin-orders.mapper';
import type {
  AdminOrderDetail,
  AdminOrdersResponse,
  AdminOrdersQueueCounts,
  AdminOrderStatsCounts,
  AdminOrderStatsResponse,
} from './admin-orders.types';
import {
  AdminOrderQueue,
  AdminOrderStatsPeriod,
  OrderStatusFilter,
  RiskSeverityFilter,
  type GetAdminOrdersDto,
  type GetAdminOrderStatsDto,
} from './dto/admin-orders.dto';
import { RISK_ACTIONABLE_STATUSES } from './order-risk-monitor.service';

const INCIDENT_FIELDS = `
  id order_id risk_type severity detected_at last_seen_at resolved_at resolution
  due_at overdue_minutes context last_notified_at last_notified_severity
  notified_count acknowledged_at acknowledged_by acknowledged_note
`;

const ORDER_FIELDS = `
  id order_number current_status fulfillment_method created_at updated_at
  status_changed_at acceptance_deadline_at promised_ready_at
  pickup_state pickup_due_at estimated_delivery_time
  promised_fulfill_by total_amount currency
  open_risk_rank open_risk_since open_risk_type
  risk_incidents(where: { resolved_at: { _is_null: true } }) { ${INCIDENT_FIELDS} }
  client { id user { id first_name last_name email phone_number } }
  business { id name user { id first_name last_name email phone_number } }
  business_location { id name phone email }
  assigned_agent { id user { id first_name last_name email phone_number } }
  delivery_time_window { id time_slot_start time_slot_end preferred_date }
  delivery_address { id address_line_1 city state }
`;

/**
 * Fulfilled orders. Some flows stop at delivered, and a rejected refund leaves
 * the order fulfilled with nothing returned to the client.
 */
const COMPLETED_STATUSES = ['delivered', 'complete', 'refund_rejected'];

/** Orders where money is on its way back, so a rejected refund is excluded. */
const REFUND_STATUSES = [
  'refund_requested',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_approved_replace',
  'refund_processing',
  'refund_failed',
  'refunded',
];

const IN_PROGRESS_STATUSES = [
  ...RISK_ACTIONABLE_STATUSES,
  'awaiting_shipment',
  'shipped',
];

/** History rows needed to derive prep and delivery durations. */
const DURATION_HISTORY_STATUSES = [
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'picked_up',
];

/** Averages read newest orders only, so the query stays predictable. */
const STATS_SAMPLE_LIMIT = 1000;

const STATS_QUERY = `query AdminOrderStats(
  $totalWhere: orders_bool_exp!
  $completedWhere: orders_bool_exp!
  $inProgressWhere: orders_bool_exp!
  $cancelledWhere: orders_bool_exp!
  $failedWhere: orders_bool_exp!
  $refundWhere: orders_bool_exp!
  $pendingPaymentWhere: orders_bool_exp!
  $historyWhere: order_status_history_bool_exp!
  $sampleLimit: Int!
) {
  total: orders_aggregate(where: $totalWhere) { aggregate { count } }
  completed: orders_aggregate(where: $completedWhere) { aggregate { count } }
  inProgress: orders_aggregate(where: $inProgressWhere) { aggregate { count } }
  cancelled: orders_aggregate(where: $cancelledWhere) { aggregate { count } }
  failed: orders_aggregate(where: $failedWhere) { aggregate { count } }
  refunds: orders_aggregate(where: $refundWhere) { aggregate { count } }
  pendingPayment: orders_aggregate(where: $pendingPaymentWhere) {
    aggregate { count }
  }
  samples: orders(
    where: $completedWhere
    order_by: { created_at: desc }
    limit: $sampleLimit
  ) {
    created_at accepted_at completed_at actual_delivery_time
    order_status_history(where: $historyWhere, order_by: { created_at: asc }) {
      status created_at
    }
  }
}`;

@Injectable()
export class AdminOrdersService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async list(query: GetAdminOrdersDto): Promise<AdminOrdersResponse> {
    const limit = Number(query.limit ?? 25);
    const offset = Number(query.offset ?? 0);
    const where = this.buildWhere(query);
    const res = await this.hasura.executeQuery(
      `query AdminOrdersQueue(
        $where: orders_bool_exp!
        $countWhere: orders_bool_exp!
        $orderBy: [orders_order_by!]!
        $limit: Int!
        $offset: Int!
      ) {
        orders(where: $where, order_by: $orderBy, limit: $limit, offset: $offset) {
          ${ORDER_FIELDS}
        }
        filtered: orders_aggregate(where: $where) { aggregate { count } }
        active: orders_aggregate(where: $countWhere) { aggregate { count } }
        atRisk: orders_aggregate(
          where: { _and: [$countWhere, { open_risk_rank: { _gt: 0 } }] }
        ) { aggregate { count } }
        critical: orders_aggregate(
          where: { _and: [$countWhere, { open_risk_rank: { _eq: 2 } }] }
        ) { aggregate { count } }
        warning: orders_aggregate(
          where: { _and: [$countWhere, { open_risk_rank: { _eq: 1 } }] }
        ) { aggregate { count } }
      }`,
      {
        where,
        countWhere: { current_status: { _in: RISK_ACTIONABLE_STATUSES } },
        orderBy: this.buildOrderBy(query),
        limit,
        offset,
      }
    );
    return {
      orders: (res.orders ?? []).map(mapAdminOrderRow),
      total: res.filtered?.aggregate?.count ?? 0,
      counts: this.buildCounts(res),
      offset,
      limit,
    };
  }

  async getStats(
    query: GetAdminOrderStatsDto
  ): Promise<AdminOrderStatsResponse> {
    const period = query.period ?? AdminOrderStatsPeriod.LAST_7_DAYS;
    const since = this.statsPeriodStart(period);
    const res = await this.hasura.executeQuery(
      STATS_QUERY,
      this.buildStatsVariables(since)
    );
    const counts = this.buildStatsCounts(res);
    return {
      period,
      since,
      counts,
      rates: computeOrderStatsRates(counts),
      averages: computeOrderStatsAverages(res.samples ?? []),
    };
  }

  private buildStatsVariables(since: string | null): Record<string, unknown> {
    const base: Record<string, unknown> = since
      ? { created_at: { _gte: since } }
      : {};
    return {
      totalWhere: base,
      completedWhere: this.statusScope(base, COMPLETED_STATUSES),
      inProgressWhere: this.statusScope(base, IN_PROGRESS_STATUSES),
      cancelledWhere: this.statusScope(base, ['cancelled']),
      failedWhere: this.statusScope(base, ['failed']),
      refundWhere: this.statusScope(base, REFUND_STATUSES),
      pendingPaymentWhere: this.statusScope(base, ['pending_payment']),
      historyWhere: { status: { _in: DURATION_HISTORY_STATUSES } },
      sampleLimit: STATS_SAMPLE_LIMIT,
    };
  }

  private statusScope(
    base: Record<string, unknown>,
    statuses: string[]
  ): Record<string, unknown> {
    return { _and: [base, { current_status: { _in: statuses } }] };
  }

  /** "Today" follows the operating timezone so the day matches merchant hours. */
  private statsPeriodStart(period: AdminOrderStatsPeriod): string | null {
    const now = DateTime.now().setZone(DEFAULT_USER_TIMEZONE);
    if (period === AdminOrderStatsPeriod.TODAY) {
      return now.startOf('day').toISO();
    }
    if (period === AdminOrderStatsPeriod.LAST_7_DAYS) {
      return now.minus({ days: 7 }).toISO();
    }
    if (period === AdminOrderStatsPeriod.LAST_30_DAYS) {
      return now.minus({ days: 30 }).toISO();
    }
    return null;
  }

  private buildStatsCounts(res: any): AdminOrderStatsCounts {
    const count = (key: string): number =>
      res?.[key]?.aggregate?.count ?? 0;
    return {
      total: count('total'),
      completed: count('completed'),
      in_progress: count('inProgress'),
      cancelled: count('cancelled'),
      failed: count('failed'),
      refunds: count('refunds'),
      pending_payment: count('pendingPayment'),
    };
  }

  async getDetail(orderId: string): Promise<AdminOrderDetail> {
    const res = await this.hasura.executeQuery(
      `query AdminOrderDetail($id: uuid!) {
        orders_by_pk(id: $id) { ${ORDER_FIELDS} }
        order_risk_incidents(
          where: { order_id: { _eq: $id }, resolved_at: { _is_null: false } }
          order_by: { detected_at: desc }
          limit: 20
        ) { ${INCIDENT_FIELDS} }
        order_events(
          where: { order_id: { _eq: $id } }
          order_by: { created_at: desc }
          limit: 100
        ) { id event_type actor_type payload created_at }
        user_messages(
          where: { entity_type: { _eq: order }, entity_id: { _eq: $id } }
          order_by: { created_at: desc }
          limit: 50
        ) {
          id message created_at
          user { first_name last_name }
          recipients { recipient_type }
        }
      }`,
      { id: orderId }
    );
    if (!res.orders_by_pk) {
      throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    }
    return {
      ...mapAdminOrderRow(res.orders_by_pk),
      resolved_incidents: mapIncidents(res.order_risk_incidents ?? []),
      timeline: res.order_events ?? [],
      messages: this.mapMessages(res.user_messages ?? []),
    };
  }

  private mapMessages(rows: any[]): AdminOrderDetail['messages'] {
    return rows.map((row) => ({
      id: row.id,
      message: row.message,
      created_at: row.created_at,
      sender_name:
        `${row.user?.first_name ?? ''} ${row.user?.last_name ?? ''}`.trim() ||
        null,
      recipient_types: (row.recipients ?? []).map(
        (recipient: any) => recipient.recipient_type
      ),
    }));
  }

  private buildCounts(res: any): AdminOrdersQueueCounts {
    return {
      total: res.active?.aggregate?.count ?? 0,
      at_risk: res.atRisk?.aggregate?.count ?? 0,
      critical: res.critical?.aggregate?.count ?? 0,
      warning: res.warning?.aggregate?.count ?? 0,
    };
  }

  /** Risk filters live on orders so pagination totals stay accurate. */
  private buildWhere(query: GetAdminOrdersDto): Record<string, unknown> {
    const conditions: Array<Record<string, unknown>> = [
      { current_status: this.statusFilter(query) },
    ];
    if (query.queue !== AdminOrderQueue.ALL) {
      conditions.push({ open_risk_rank: { _gt: 0 } });
    }
    if (query.severity && query.severity !== RiskSeverityFilter.ALL) {
      conditions.push({
        open_risk_rank: { _eq: query.severity === 'critical' ? 2 : 1 },
      });
    }
    if (query.risk_type) {
      conditions.push({
        risk_incidents: {
          resolved_at: { _is_null: true },
          risk_type: { _eq: query.risk_type },
        },
      });
    }
    if (query.fulfillment_method) {
      conditions.push({ fulfillment_method: { _eq: query.fulfillment_method } });
    }
    const search = query.search?.trim();
    if (search) conditions.push(this.searchFilter(search));
    return { _and: conditions };
  }

  private statusFilter(query: GetAdminOrdersDto): Record<string, unknown> {
    if (query.status && query.status !== OrderStatusFilter.ALL) {
      return { _eq: query.status };
    }
    return { _in: RISK_ACTIONABLE_STATUSES };
  }

  private searchFilter(search: string): Record<string, unknown> {
    const pattern = `%${search}%`;
    return {
      _or: [
        { order_number: { _ilike: pattern } },
        { client: { user: { first_name: { _ilike: pattern } } } },
        { client: { user: { last_name: { _ilike: pattern } } } },
        { client: { user: { email: { _ilike: pattern } } } },
        { business: { name: { _ilike: pattern } } },
      ],
    };
  }

  /** Attention queue leads with critical, then the longest-waiting risk. */
  private buildOrderBy(query: GetAdminOrdersDto): Array<Record<string, unknown>> {
    if (query.queue === AdminOrderQueue.ALL) {
      return [
        { open_risk_rank: 'desc' },
        { created_at: 'desc' },
      ];
    }
    return [
      { open_risk_rank: 'desc' },
      { open_risk_since: 'asc' },
      { created_at: 'asc' },
    ];
  }
}
