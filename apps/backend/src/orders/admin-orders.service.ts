import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { mapAdminOrderRow, mapIncidents } from './admin-orders.mapper';
import type {
  AdminOrderDetail,
  AdminOrdersResponse,
  AdminOrdersQueueCounts,
} from './admin-orders.types';
import {
  AdminOrderQueue,
  OrderStatusFilter,
  RiskSeverityFilter,
  type GetAdminOrdersDto,
} from './dto/admin-orders.dto';
import { RISK_ACTIONABLE_STATUSES } from './order-risk-monitor.service';

const INCIDENT_FIELDS = `
  id order_id risk_type severity detected_at last_seen_at resolved_at resolution
  due_at overdue_minutes context last_notified_at last_notified_severity
  notified_count acknowledged_at acknowledged_by acknowledged_note
`;

const ORDER_FIELDS = `
  id order_number current_status fulfillment_method created_at updated_at
  acceptance_deadline_at pickup_state pickup_due_at estimated_delivery_time
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
