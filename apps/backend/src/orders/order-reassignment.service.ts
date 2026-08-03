import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderEventsService } from './order-events.service';
import { OrderOffersService } from './order-offers.service';
import type { MonitoredPickupOrder } from './order-pickup.types';

@Injectable()
export class OrderReassignmentService {
  private readonly logger = new Logger(OrderReassignmentService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly orderEvents: OrderEventsService,
    private readonly notifications: NotificationsService,
    private readonly orderOffers: OrderOffersService,
    private readonly accountsService: AccountsService
  ) {}

  async reassignOrder(
    orderId: string,
    reason: string,
    options?: { skipReliabilityPenalty?: boolean; maxReassignments?: number }
  ): Promise<{ success: boolean; message: string }> {
    const order = await this.fetchAssignedOrder(orderId);
    if (!order) {
      return { success: false, message: 'Order not assigned' };
    }
    const max = options?.maxReassignments ?? 2;
    if ((order.reassignment_count || 0) >= max) {
      return this.escalateStrikeOut(order);
    }
    const previousAgentId = order.assigned_agent_id!;
    const dropped = await this.systemDrop(order);
    if (!dropped) {
      return { success: false, message: 'Could not unassign agent' };
    }
    await this.afterDrop(order, previousAgentId, reason, options);
    return { success: true, message: 'Order reassigned to open pool' };
  }

  async reportIssueAndRelease(
    orderId: string,
    agentId: string,
    issueReason: string
  ): Promise<{ success: boolean; message: string }> {
    const order = await this.fetchAssignedOrder(orderId);
    if (!order || order.assigned_agent_id !== agentId) {
      return { success: false, message: 'Not assigned to this agent' };
    }
    await this.orderEvents.recordEvent({
      orderId,
      eventType: 'agent_reported_issue',
      actorType: 'agent',
      actorId: agentId,
      payload: { reason: issueReason },
    });
    await this.bumpIssueCount(agentId);
    return this.reassignOrder(orderId, `agent_issue:${issueReason}`, {
      skipReliabilityPenalty: true,
    });
  }

  private async afterDrop(
    order: MonitoredPickupOrder,
    previousAgentId: string,
    reason: string,
    options?: { skipReliabilityPenalty?: boolean }
  ): Promise<void> {
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'reassignment_started',
      actorType: 'system',
      actorId: previousAgentId,
      payload: { reason },
    });
    if (!options?.skipReliabilityPenalty) {
      await this.bumpReassignedCount(previousAgentId);
    }
    await this.notifyParties(order, previousAgentId);
    await this.redispatch(order.id);
  }

  private async systemDrop(order: MonitoredPickupOrder): Promise<boolean> {
    const nextCount = (order.reassignment_count || 0) + 1;
    const result = await this.hasura.executeMutation(
      `mutation SystemDropOrder($id: uuid!, $agentId: uuid!, $count: Int!) {
        update_orders(
          where: {
            _and: [
              { id: { _eq: $id } }
              { current_status: { _eq: "assigned_to_agent" } }
              { assigned_agent_id: { _eq: $agentId } }
            ]
          }
          _set: {
            assigned_agent_id: null
            current_status: "ready_for_pickup"
            pickup_state: null
            pickup_due_at: null
            pickup_reminder_sent_at: null
            pickup_at_risk_at: null
            pickup_overdue_at: null
            pickup_extension_minutes: 0
            pickup_paused_at: null
            pickup_pause_reason: null
            pickup_pause_remaining_ms: null
            last_agent_distance_m: null
            last_agent_progress_at: null
            agent_arrived_pickup_at: null
            dispatch_round: 0
            dispatch_exhausted_at: null
            dispatch_ready_at: "now()"
            reassignment_count: $count
          }
        ) {
          affected_rows
        }
      }`,
      {
        id: order.id,
        agentId: order.assigned_agent_id,
        count: nextCount,
      }
    );
    const affected = result?.update_orders?.affected_rows ?? 0;
    if (affected !== 1) return false;
    await this.releaseHold(order);
    await this.insertHistory(order.id, 'System reassigned order after pickup SLA');
    return true;
  }

  private async releaseHold(order: MonitoredPickupOrder): Promise<void> {
    const hold = await this.fetchActiveAgentHold(order.id);
    if (!hold) return;
    const credited = await this.creditHoldRelease(order, hold);
    if (!credited) {
      this.logger.error(
        `Hold row left active for order ${order.order_number}: release failed`
      );
      return;
    }
    await this.cancelHoldRow(hold.id);
  }

  private async fetchActiveAgentHold(
    orderId: string
  ): Promise<{ id: string; agent_hold_amount: number } | null> {
    const holdRes = await this.hasura.executeQuery(
      `query OrderHold($id: uuid!) {
        order_holds(
          where: {
            order_id: { _eq: $id }
            status: { _eq: active }
          }
          limit: 1
        ) {
          id agent_hold_amount agent_id status
        }
      }`,
      { id: orderId }
    );
    return holdRes.order_holds?.[0] ?? null;
  }

  private async creditHoldRelease(
    order: MonitoredPickupOrder,
    hold: { agent_hold_amount: number }
  ): Promise<boolean> {
    if (Number(hold.agent_hold_amount) <= 0) return true;
    const userId = order.assigned_agent?.user_id;
    if (!userId) {
      this.logger.error(
        `Hold funds not credited for order ${order.order_number}: agent user missing`
      );
      return false;
    }
    const account = await this.hasura.getAccount(
      userId,
      (order as any).currency || 'XAF'
    );
    if (!account) {
      this.logger.error(
        `Hold funds not credited for order ${order.order_number}: agent account missing`
      );
      return false;
    }
    const released = await this.accountsService.registerReleaseIfNotExists({
      accountId: account.id,
      amount: hold.agent_hold_amount,
      memo: `Hold released for order ${order.order_number}. System reassignment.`,
      referenceId: order.id,
    });
    if (!released.success) {
      this.logger.error(
        `Hold release failed for order ${order.order_number}: ${released.error}`
      );
      return false;
    }
    return true;
  }

  private async cancelHoldRow(holdId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation CancelHold($id: uuid!) {
        update_order_holds(
          where: {
            _and: [
              { id: { _eq: $id } }
              { status: { _eq: active } }
            ]
          }
          _set: { status: "cancelled" }
        ) { affected_rows }
      }`,
      { id: holdId }
    );
  }

  private async redispatch(orderId: string): Promise<void> {
    try {
      await this.orderOffers.runDispatchRound(orderId, 1);
    } catch (error: any) {
      this.logger.error(`Redispatch failed for ${orderId}: ${error?.message}`);
      await this.orderEvents.recordEvent({
        orderId,
        eventType: 'reassignment_pool_empty',
        actorType: 'system',
        payload: { error: error?.message },
      });
    }
  }

  private async notifyParties(
    order: MonitoredPickupOrder,
    previousAgentId: string
  ): Promise<void> {
    const agentUserId =
      order.assigned_agent?.user_id ||
      (await this.fetchAgentUserId(previousAgentId));
    await this.notifications.sendPickupReassignedAgentPush({
      agentUserId,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.assigned_agent?.user?.preferred_language,
    });
    await this.notifications.sendPickupReassignedBusinessPush({
      businessUserId: order.business?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.business?.user?.preferred_language,
    });
    await this.notifications.sendPickupReassignedCustomerPush({
      clientUserId: order.client?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.client?.user?.preferred_language,
    });
  }

  private async escalateStrikeOut(
    order: MonitoredPickupOrder
  ): Promise<{ success: boolean; message: string }> {
    const previousAgentId = order.assigned_agent_id!;
    const dropped = await this.systemDrop(order);
    if (!dropped) return this.alreadyEscalatedResult();
    this.logger.warn(
      `Pickup reassignment strike-out for order ${order.order_number}`
    );
    await this.recordAndNotifyStrikeOut(order, previousAgentId);
    return {
      success: true,
      message: 'Agent released; escalated to support (max reassignments)',
    };
  }

  private alreadyEscalatedResult(): { success: boolean; message: string } {
    return {
      success: false,
      message: 'Max reassignments reached; already escalated',
    };
  }

  private async recordAndNotifyStrikeOut(
    order: MonitoredPickupOrder,
    previousAgentId: string
  ): Promise<void> {
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'reassignment_pool_empty',
      actorType: 'system',
      payload: { reason: 'max_reassignments' },
    });
    const agentUserId =
      order.assigned_agent?.user_id ||
      (await this.fetchAgentUserId(previousAgentId));
    await this.notifications.sendPickupReassignedAgentPush({
      agentUserId,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.assigned_agent?.user?.preferred_language,
    });
    await this.notifications.sendPickupReassignmentEscalationPush({
      businessUserId: order.business?.user_id,
      clientUserId: order.client?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
    });
  }

  private async fetchAssignedOrder(
    orderId: string
  ): Promise<(MonitoredPickupOrder & { currency?: string }) | null> {
    const res = await this.hasura.executeQuery(
      `query ReassignOrder($id: uuid!) {
        orders_by_pk(id: $id) {
          id order_number current_status assigned_agent_id currency
          reassignment_count pickup_state business_id
          client { user_id user { preferred_language email } }
          business { user_id name user { preferred_language email } }
          assigned_agent {
            id user_id user { preferred_language first_name }
          }
        }
      }`,
      { id: orderId }
    );
    const order = res.orders_by_pk;
    if (!order || order.current_status !== 'assigned_to_agent') return null;
    if (!order.assigned_agent_id) return null;
    return order;
  }

  private async fetchAgentUserId(agentId: string): Promise<string | undefined> {
    const res = await this.hasura.executeQuery(
      `query AgentUser($id: uuid!) {
        agents_by_pk(id: $id) { user_id }
      }`,
      { id: agentId }
    );
    return res.agents_by_pk?.user_id;
  }

  private async bumpReassignedCount(agentId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation BumpReassigned($id: uuid!) {
        update_agents_by_pk(
          pk_columns: { id: $id }
          _inc: { pickups_reassigned_count: 1 }
        ) { id pickups_reassigned_count pickups_completed_count }
      }`,
      { id: agentId }
    );
    await this.recomputeReliability(agentId);
  }

  private async bumpIssueCount(agentId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation BumpIssue($id: uuid!) {
        update_agents_by_pk(
          pk_columns: { id: $id }
          _inc: { pickup_issues_reported_count: 1 }
        ) { id }
      }`,
      { id: agentId }
    );
  }

  private async recomputeReliability(agentId: string): Promise<void> {
    const res = await this.hasura.executeQuery(
      `query AgentRel($id: uuid!) {
        agents_by_pk(id: $id) {
          pickups_completed_count pickups_reassigned_count
        }
      }`,
      { id: agentId }
    );
    const a = res.agents_by_pk;
    if (!a) return;
    const completed = a.pickups_completed_count || 0;
    const reassigned = a.pickups_reassigned_count || 0;
    const denom = Math.max(1, completed + reassigned);
    const score = Math.max(
      0,
      Math.min(100, Math.round((completed / denom) * 100 - (reassigned / denom) * 40))
    );
    await this.hasura.executeMutation(
      `mutation SetPickupRel($id: uuid!, $score: numeric!) {
        update_agents_by_pk(
          pk_columns: { id: $id }
          _set: { pickup_reliability_score: $score }
        ) { id }
      }`,
      { id: agentId, score }
    );
  }

  private async insertHistory(orderId: string, notes: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation Hist($orderId: uuid!, $notes: String!) {
        insert_order_status_history(objects: [{
          order_id: $orderId
          status: ready_for_pickup
          notes: $notes
          changed_by_type: "system"
        }]) { affected_rows }
      }`,
      { orderId, notes }
    );
  }
}
