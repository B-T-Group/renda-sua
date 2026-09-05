import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type {
  OrderRiskFinding,
  OrderRiskIncident,
  OrderRiskSeverity,
  OrderRiskType,
} from './order-risk.types';

const INCIDENT_FIELDS = `
  id order_id risk_type severity detected_at last_seen_at resolved_at resolution
  due_at overdue_minutes context last_notified_at last_notified_severity
  notified_count acknowledged_at acknowledged_by acknowledged_note
  resolved_by contact_channel order_result
`;

export interface RaisedIncident {
  incident: OrderRiskIncident;
  /** True when this is the first time the incident opened. */
  isNew: boolean;
  /** True when severity increased since the last superuser alert. */
  escalated: boolean;
}

@Injectable()
export class OrderRiskIncidentsService {
  private readonly logger = new Logger(OrderRiskIncidentsService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  /** Opens a new incident or refreshes the existing open one for this risk type. */
  async raise(
    orderId: string,
    finding: OrderRiskFinding
  ): Promise<RaisedIncident | null> {
    try {
      const existing = await this.findOpen(orderId, finding.riskType);
      if (!existing) {
        const incident = await this.insert(orderId, finding);
        return incident ? { incident, isNew: true, escalated: false } : null;
      }
      const incident = await this.refresh(existing, finding);
      return {
        incident,
        isNew: false,
        escalated: this.hasEscalated(existing, finding.severity),
      };
    } catch (error: any) {
      this.logger.error(
        `raise ${finding.riskType} failed for order ${orderId}: ${error?.message}`
      );
      return null;
    }
  }

  /** Closes open incidents for this order whose risk type is no longer active. */
  async resolveStale(
    orderId: string,
    activeTypes: OrderRiskType[],
    resolution = 'auto_resolved'
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation ResolveStaleOrderRisk(
        $orderId: uuid!
        $activeTypes: [order_risk_type!]!
        $resolvedAt: timestamptz!
        $resolution: String!
      ) {
        update_order_risk_incidents(
          where: {
            order_id: { _eq: $orderId }
            resolved_at: { _is_null: true }
            risk_type: { _nin: $activeTypes }
          }
          _set: { resolved_at: $resolvedAt, resolution: $resolution }
        ) { affected_rows }
      }`,
      {
        orderId,
        activeTypes,
        resolvedAt: new Date().toISOString(),
        resolution,
      }
    );
  }

  /** Closes every open incident for an order (used when the order reaches a final state). */
  async resolveAllForOrders(
    orderIds: string[],
    resolution = 'order_closed'
  ): Promise<void> {
    if (!orderIds.length) return;
    await this.hasura.executeMutation(
      `mutation ResolveOrderRiskForOrders(
        $orderIds: [uuid!]!
        $resolvedAt: timestamptz!
        $resolution: String!
      ) {
        update_order_risk_incidents(
          where: {
            order_id: { _in: $orderIds }
            resolved_at: { _is_null: true }
          }
          _set: { resolved_at: $resolvedAt, resolution: $resolution }
        ) { affected_rows }
      }`,
      { orderIds, resolvedAt: new Date().toISOString(), resolution }
    );
  }

  async listOpenForOrders(orderIds: string[]): Promise<OrderRiskIncident[]> {
    if (!orderIds.length) return [];
    const res = await this.hasura.executeQuery<{
      order_risk_incidents: OrderRiskIncident[];
    }>(
      `query OpenOrderRiskIncidents($orderIds: [uuid!]!) {
        order_risk_incidents(
          where: {
            order_id: { _in: $orderIds }
            resolved_at: { _is_null: true }
          }
          order_by: { detected_at: asc }
        ) { ${INCIDENT_FIELDS} }
      }`,
      { orderIds }
    );
    return res.order_risk_incidents ?? [];
  }

  /** Order ids with an open incident, newest risk first, for the attention queue. */
  async listOpenOrderIds(params: {
    severities?: OrderRiskSeverity[];
    riskTypes?: OrderRiskType[];
  }): Promise<string[]> {
    const where: Record<string, unknown> = { resolved_at: { _is_null: true } };
    if (params.severities?.length) where.severity = { _in: params.severities };
    if (params.riskTypes?.length) where.risk_type = { _in: params.riskTypes };
    const res = await this.hasura.executeQuery<{
      order_risk_incidents: Array<{ order_id: string }>;
    }>(
      `query OpenOrderRiskIds($where: order_risk_incidents_bool_exp!) {
        order_risk_incidents(where: $where, order_by: { detected_at: asc }) {
          order_id
        }
      }`,
      { where }
    );
    const ids = (res.order_risk_incidents ?? []).map((row) => row.order_id);
    return Array.from(new Set(ids));
  }

  /**
   * Stores the channel results of an alert attempt. Only a delivered attempt
   * advances `last_notified_at`/`notified_count`, so a failed send still lets the
   * next sweep retry instead of silently sitting out the repeat cooldown.
   */
  async recordAlertAttempt(params: {
    incidentId: string;
    severity: OrderRiskSeverity;
    channels: unknown[];
    delivered: boolean;
  }): Promise<void> {
    const set: Record<string, unknown> = { notified_channels: params.channels };
    if (params.delivered) {
      set.last_notified_at = new Date().toISOString();
      set.last_notified_severity = params.severity;
    }
    await this.hasura.executeMutation(
      `mutation RecordOrderRiskAlertAttempt(
        $id: uuid!
        $set: order_risk_incidents_set_input!
        $inc: order_risk_incidents_inc_input!
      ) {
        update_order_risk_incidents_by_pk(
          pk_columns: { id: $id }
          _set: $set
          _inc: $inc
        ) { id }
      }`,
      {
        id: params.incidentId,
        set,
        inc: { notified_count: params.delivered ? 1 : 0 },
      }
    );
  }

  async acknowledge(params: {
    incidentId: string;
    userId: string;
    note?: string | null;
    resolve?: boolean;
    contactChannel?: string | null;
    orderResult?: string | null;
  }): Promise<{ incident: OrderRiskIncident | null; applied: boolean }> {
    if (params.resolve) return this.resolveIfOpen(params);
    return this.touchAcknowledgement(params);
  }

  private ackSet(params: {
    userId: string;
    note?: string | null;
    resolve?: boolean;
    contactChannel?: string | null;
    orderResult?: string | null;
  }): Record<string, unknown> {
    const now = new Date().toISOString();
    const set: Record<string, unknown> = {
      acknowledged_at: now,
      acknowledged_by: params.userId,
      acknowledged_note: params.note?.trim() || null,
    };
    if (!params.resolve) return set;
    set.resolved_at = now;
    set.resolution = 'acknowledged_resolved';
    set.resolved_by = params.userId;
    if (params.contactChannel) set.contact_channel = params.contactChannel;
    if (params.orderResult) set.order_result = params.orderResult;
    return set;
  }

  private async touchAcknowledgement(params: {
    incidentId: string;
    userId: string;
    note?: string | null;
  }): Promise<{ incident: OrderRiskIncident | null; applied: boolean }> {
    const res = await this.hasura.executeMutation<{
      update_order_risk_incidents_by_pk: OrderRiskIncident | null;
    }>(
      `mutation AcknowledgeOrderRisk(
        $id: uuid!
        $set: order_risk_incidents_set_input!
      ) {
        update_order_risk_incidents_by_pk(pk_columns: { id: $id }, _set: $set) {
          ${INCIDENT_FIELDS}
        }
      }`,
      { id: params.incidentId, set: this.ackSet(params) }
    );
    const incident = res.update_order_risk_incidents_by_pk;
    return { incident, applied: !!incident };
  }

  private async resolveIfOpen(params: {
    incidentId: string;
    userId: string;
    note?: string | null;
    contactChannel?: string | null;
    orderResult?: string | null;
  }): Promise<{ incident: OrderRiskIncident | null; applied: boolean }> {
    const res = await this.hasura.executeMutation<{
      update_order_risk_incidents: { returning: OrderRiskIncident[] };
    }>(
      `mutation ResolveOpenOrderRisk(
        $id: uuid!
        $set: order_risk_incidents_set_input!
      ) {
        update_order_risk_incidents(
          where: { id: { _eq: $id }, resolved_at: { _is_null: true } }
          _set: $set
        ) {
          returning { ${INCIDENT_FIELDS} }
        }
      }`,
      { id: params.incidentId, set: this.ackSet({ ...params, resolve: true }) }
    );
    const updated = res.update_order_risk_incidents?.returning?.[0] ?? null;
    if (updated) return { incident: updated, applied: true };
    const existing = await this.getIncident(params.incidentId);
    return { incident: existing, applied: false };
  }

  private async getIncident(
    incidentId: string
  ): Promise<OrderRiskIncident | null> {
    const res = await this.hasura.executeQuery<{
      order_risk_incidents_by_pk: OrderRiskIncident | null;
    }>(
      `query OrderRiskIncidentByPk($id: uuid!) {
        order_risk_incidents_by_pk(id: $id) { ${INCIDENT_FIELDS} }
      }`,
      { id: incidentId }
    );
    return res.order_risk_incidents_by_pk;
  }

  private async findOpen(
    orderId: string,
    riskType: OrderRiskType
  ): Promise<OrderRiskIncident | null> {
    const res = await this.hasura.executeQuery<{
      order_risk_incidents: OrderRiskIncident[];
    }>(
      `query OpenOrderRiskIncident($orderId: uuid!, $riskType: order_risk_type!) {
        order_risk_incidents(
          where: {
            order_id: { _eq: $orderId }
            risk_type: { _eq: $riskType }
            resolved_at: { _is_null: true }
          }
          limit: 1
        ) { ${INCIDENT_FIELDS} }
      }`,
      { orderId, riskType }
    );
    return res.order_risk_incidents?.[0] ?? null;
  }

  private async insert(
    orderId: string,
    finding: OrderRiskFinding
  ): Promise<OrderRiskIncident | null> {
    try {
      const res = await this.hasura.executeMutation<{
        insert_order_risk_incidents_one: OrderRiskIncident | null;
      }>(
        `mutation InsertOrderRiskIncident(
          $object: order_risk_incidents_insert_input!
        ) {
          insert_order_risk_incidents_one(object: $object) {
            ${INCIDENT_FIELDS}
          }
        }`,
        { object: this.toInsertInput(orderId, finding) }
      );
      return res.insert_order_risk_incidents_one;
    } catch (error: any) {
      // The partial unique index rejects a concurrent duplicate; reuse the winner.
      this.logger.warn(
        `Concurrent risk incident for order ${orderId}: ${error?.message}`
      );
      return this.findOpen(orderId, finding.riskType);
    }
  }

  private toInsertInput(
    orderId: string,
    finding: OrderRiskFinding
  ): Record<string, unknown> {
    return {
      order_id: orderId,
      risk_type: finding.riskType,
      severity: finding.severity,
      due_at: finding.dueAt,
      overdue_minutes: finding.overdueMinutes,
      context: { reason: finding.reason },
    };
  }

  private async refresh(
    existing: OrderRiskIncident,
    finding: OrderRiskFinding
  ): Promise<OrderRiskIncident> {
    const res = await this.hasura.executeMutation<{
      update_order_risk_incidents_by_pk: OrderRiskIncident | null;
    }>(
      `mutation RefreshOrderRiskIncident(
        $id: uuid!
        $set: order_risk_incidents_set_input!
      ) {
        update_order_risk_incidents_by_pk(pk_columns: { id: $id }, _set: $set) {
          ${INCIDENT_FIELDS}
        }
      }`,
      {
        id: existing.id,
        set: {
          last_seen_at: new Date().toISOString(),
          severity: finding.severity,
          due_at: finding.dueAt,
          overdue_minutes: finding.overdueMinutes,
          context: { reason: finding.reason },
        },
      }
    );
    return res.update_order_risk_incidents_by_pk ?? existing;
  }

  private hasEscalated(
    existing: OrderRiskIncident,
    severity: OrderRiskSeverity
  ): boolean {
    return severity === 'critical' && existing.last_notified_severity !== 'critical';
  }
}
