import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { OrderRiskAlertService } from './order-risk-alert.service';
import { OrderRiskConfigService } from './order-risk-config.service';
import { OrderRiskIncidentsService } from './order-risk-incidents.service';
import { evaluateOrderRisk } from './order-risk-rules';
import {
  IN_DELIVERY_STATUSES,
  type OrderRiskConfig,
  type RiskEvaluableOrder,
} from './order-risk.types';

/** Statuses a superuser can still act on. Anything else closes its incidents. */
export const RISK_ACTIONABLE_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  ...IN_DELIVERY_STATUSES,
];

const PAGE_SIZE = 200;

const RISK_ORDER_FIELDS = `
  id order_number current_status fulfillment_method created_at updated_at
  status_changed_at acceptance_state acceptance_deadline_at
  acceptance_activates_at grace_deadline_at accepted_at promised_ready_at
  dispatch_exhausted_at assigned_agent_id assigned_at pickup_state pickup_due_at
  agent_arrived_pickup_at estimated_delivery_time promised_fulfill_by
  delivery_time_window { preferred_date time_slot_end }
`;

@Injectable()
export class OrderRiskMonitorService {
  private readonly logger = new Logger(OrderRiskMonitorService.name);
  private running = false;

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly config: OrderRiskConfigService,
    private readonly incidents: OrderRiskIncidentsService,
    private readonly alerts: OrderRiskAlertService
  ) {}

  /** Single-flight so a slow sweep never overlaps the next tick. */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const config = await this.config.load();
      const orders = await this.fetchActionableOrders();
      const withOpenIncidents = new Set(
        (await this.incidents.listOpenForOrders(orders.map((o) => o.id))).map(
          (incident) => incident.order_id
        )
      );
      await this.evaluateAll(orders, withOpenIncidents, config);
      await this.closeIncidentsForClosedOrders();
    } catch (error: any) {
      this.logger.error(`Order risk sweep failed: ${error?.message}`);
    } finally {
      this.running = false;
    }
  }

  /** Evaluates one order on demand, used by authoritative status transitions. */
  async evaluateOrderById(orderId: string): Promise<void> {
    try {
      const order = await this.fetchOrder(orderId);
      if (!order) return;
      if (!RISK_ACTIONABLE_STATUSES.includes(order.current_status)) {
        await this.incidents.resolveAllForOrders([orderId]);
        return;
      }
      await this.evaluateOrder(order, true, await this.config.load());
    } catch (error: any) {
      this.logger.error(`evaluateOrderById ${orderId}: ${error?.message}`);
    }
  }

  private async evaluateAll(
    orders: RiskEvaluableOrder[],
    withOpenIncidents: Set<string>,
    config: OrderRiskConfig
  ): Promise<void> {
    for (const order of orders) {
      await this.evaluateOrder(order, withOpenIncidents.has(order.id), config);
    }
  }

  private async evaluateOrder(
    order: RiskEvaluableOrder,
    hasOpenIncidents: boolean,
    config: OrderRiskConfig
  ): Promise<void> {
    const findings = evaluateOrderRisk(order, config, DateTime.utc());
    if (!findings.length && !hasOpenIncidents) return;
    await this.incidents.resolveStale(
      order.id,
      findings.map((finding) => finding.riskType)
    );
    for (const finding of findings) {
      const raised = await this.incidents.raise(order.id, finding);
      if (!raised) continue;
      await this.alerts.alertIfDue({
        orderId: order.id,
        orderNumber: order.order_number ?? order.id,
        raised,
        finding,
        config,
      });
    }
  }

  /** Resolves incidents left behind when an order was delivered, cancelled, or refunded. */
  private async closeIncidentsForClosedOrders(): Promise<void> {
    const res = await this.hasura.executeQuery<{
      order_risk_incidents: Array<{ order_id: string }>;
    }>(
      `query ClosedOrdersWithOpenRisk($statuses: [order_status_enum!]!) {
        order_risk_incidents(
          where: {
            resolved_at: { _is_null: true }
            order: { current_status: { _nin: $statuses } }
          }
        ) { order_id }
      }`,
      { statuses: RISK_ACTIONABLE_STATUSES }
    );
    const orderIds = Array.from(
      new Set((res.order_risk_incidents ?? []).map((row) => row.order_id))
    );
    await this.incidents.resolveAllForOrders(orderIds);
  }

  private async fetchActionableOrders(): Promise<RiskEvaluableOrder[]> {
    const all: RiskEvaluableOrder[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await this.fetchActionablePage(offset);
      all.push(...page);
      if (page.length < PAGE_SIZE) return all;
    }
  }

  private async fetchActionablePage(
    offset: number
  ): Promise<RiskEvaluableOrder[]> {
    const res = await this.hasura.executeQuery<{ orders: RiskEvaluableOrder[] }>(
      `query RiskActionableOrders(
        $statuses: [order_status_enum!]!, $limit: Int!, $offset: Int!
      ) {
        orders(
          where: { current_status: { _in: $statuses } }
          order_by: { created_at: asc }
          limit: $limit
          offset: $offset
        ) { ${RISK_ORDER_FIELDS} }
      }`,
      { statuses: RISK_ACTIONABLE_STATUSES, limit: PAGE_SIZE, offset }
    );
    return res.orders ?? [];
  }

  private async fetchOrder(orderId: string): Promise<RiskEvaluableOrder | null> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: RiskEvaluableOrder | null;
    }>(
      `query RiskOrder($id: uuid!) {
        orders_by_pk(id: $id) { ${RISK_ORDER_FIELDS} }
      }`,
      { id: orderId }
    );
    return res.orders_by_pk ?? null;
  }
}
