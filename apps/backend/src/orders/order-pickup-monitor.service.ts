import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderEventsService } from './order-events.service';
import {
  DEFAULT_PICKUP_MONITOR_CONFIG,
  type MonitoredPickupOrder,
  type OrderPickupState,
  type PickupMonitorConfig,
  type PickupPauseReason,
} from './order-pickup.types';
import { OrderReassignmentService } from './order-reassignment.service';
import { PickupProgressService } from './pickup-progress.service';

@Injectable()
export class OrderPickupMonitorService {
  private readonly logger = new Logger(OrderPickupMonitorService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly orderEvents: OrderEventsService,
    private readonly notifications: NotificationsService,
    private readonly progress: PickupProgressService,
    private readonly reassignment: OrderReassignmentService
  ) {}

  async startMonitoring(orderId: string): Promise<void> {
    const order = await this.fetchOrder(orderId);
    if (!order || order.current_status !== 'assigned_to_agent') return;
    const config = await this.loadConfig();
    const assignedAt = order.assigned_at
      ? new Date(order.assigned_at)
      : new Date();
    const dueAt = this.computePickupDueAt(order, assignedAt, config);
    await this.persistMonitoringStart(orderId, assignedAt, dueAt);
    await this.orderEvents.recordEvent({
      orderId,
      eventType: 'agent_assigned',
      actorType: 'system',
      actorId: order.assigned_agent_id,
      payload: {
        pickupDueAt: dueAt.toISOString(),
        pickupBy: order.pickup_by,
      },
    });
    if ((order.reassignment_count || 0) > 0) {
      await this.orderEvents.recordEvent({
        orderId,
        eventType: 'reassigned',
        actorType: 'system',
        actorId: order.assigned_agent_id,
        payload: { reassignmentCount: order.reassignment_count },
      });
    }
  }

  computePickupDueAt(
    order: { pickup_by?: string | null },
    assignedAt: Date,
    config: PickupMonitorConfig
  ): Date {
    const slaDue = new Date(
      assignedAt.getTime() + config.pickupSlaMinutes * 60 * 1000
    );
    if (!order.pickup_by) return slaDue;
    const pickupBy = new Date(order.pickup_by);
    if (Number.isNaN(pickupBy.getTime())) return slaDue;
    return pickupBy.getTime() > slaDue.getTime() ? pickupBy : slaDue;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcilePickupMonitoring(): Promise<void> {
    try {
      const config = await this.loadConfig();
      await this.reconcileReminders(config);
      await this.reconcileAtRisk(config);
      await this.reconcileOverdue(config);
      await this.reconcileReassignment(config);
    } catch (error: any) {
      this.logger.error(`Pickup monitor failed: ${error?.message}`);
    }
  }

  async requestExtension(
    orderId: string,
    agentId: string
  ): Promise<{ success: boolean; pickupDueAt?: string; message: string }> {
    const order = await this.fetchOrder(orderId);
    this.assertAssignedAgent(order, agentId);
    if ((order!.pickup_extension_minutes || 0) > 0) {
      return { success: false, message: 'Extension already used' };
    }
    const config = await this.loadConfig();
    const due = this.extendDueAt(order!, config.extensionMinutes);
    await this.persistExtension(orderId, due, config.extensionMinutes);
    await this.orderEvents.recordEvent({
      orderId,
      eventType: 'agent_extension_requested',
      actorType: 'agent',
      actorId: agentId,
      payload: { minutes: config.extensionMinutes, pickupDueAt: due },
    });
    return {
      success: true,
      pickupDueAt: due,
      message: `Pickup deadline extended by ${config.extensionMinutes} minutes`,
    };
  }

  async pausePickup(
    orderId: string,
    reason: PickupPauseReason,
    actorType: 'business' | 'agent' | 'support',
    actorId?: string,
    extraMinutes?: number
  ): Promise<{ success: boolean; message: string }> {
    const order = await this.fetchOrder(orderId);
    if (!order || order.current_status !== 'assigned_to_agent') {
      return { success: false, message: 'Order is not assigned' };
    }
    if (order.pickup_state === 'paused') {
      return { success: false, message: 'Pickup monitoring already paused' };
    }
    const remaining = this.remainingMs(order.pickup_due_at);
    await this.persistPause(orderId, reason, remaining, extraMinutes);
    await this.orderEvents.recordEvent({
      orderId,
      eventType:
        reason === 'support_hold'
          ? 'support_hold_started'
          : 'merchant_delay_started',
      actorType,
      actorId,
      payload: { reason, remainingMs: remaining, extraMinutes },
    });
    return { success: true, message: 'Pickup monitoring paused' };
  }

  async resumePickup(
    orderId: string,
    actorType: 'business' | 'support' | 'system',
    actorId?: string
  ): Promise<{ success: boolean; message: string }> {
    const order = await this.fetchOrder(orderId);
    if (!order || order.pickup_state !== 'paused') {
      return { success: false, message: 'Order is not paused' };
    }
    const dueAt = new Date(
      Date.now() + Math.max(0, order.pickup_pause_remaining_ms || 0)
    ).toISOString();
    await this.persistResume(orderId, dueAt);
    await this.orderEvents.recordEvent({
      orderId,
      eventType:
        order.pickup_pause_reason === 'support_hold'
          ? 'support_hold_ended'
          : 'merchant_delay_ended',
      actorType,
      actorId,
      payload: { pickupDueAt: dueAt },
    });
    return { success: true, message: 'Pickup monitoring resumed' };
  }

  async clearMonitoring(orderId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation ClearPickupMonitor($id: uuid!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
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
          }
        ) { id }
      }`,
      { id: orderId }
    );
  }

  async markRecovered(orderId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation RecoverPickup($id: uuid!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: { pickup_state: recovered }
        ) { id }
      }`,
      { id: orderId }
    );
  }

  async loadConfig(): Promise<PickupMonitorConfig> {
    const keys = [
      'pickup_sla_minutes',
      'pickup_reminder_minutes_before',
      'pickup_overdue_grace_minutes',
      'pickup_reassignment_grace_minutes',
      'pickup_extension_minutes',
      'pickup_geofence_meters',
      'pickup_approach_delta_meters',
      'pickup_gps_stale_minutes',
      'pickup_auto_reassignment_enabled',
      'pickup_max_reassignments',
    ];
    const res = await this.hasura.executeQuery(
      `query PickupCfg($keys: [String!]!) {
        application_configurations(where: { config_key: { _in: $keys } }) {
          config_key number_value
        }
      }`,
      { keys }
    );
    return this.mapConfig(res.application_configurations || []);
  }

  private mapConfig(
    rows: Array<{ config_key: string; number_value?: number | null }>
  ): PickupMonitorConfig {
    const map = rows.reduce((acc: Record<string, number>, row) => {
      if (row.number_value != null) acc[row.config_key] = Number(row.number_value);
      return acc;
    }, {});
    const d = DEFAULT_PICKUP_MONITOR_CONFIG;
    return {
      pickupSlaMinutes: map.pickup_sla_minutes ?? d.pickupSlaMinutes,
      reminderMinutesBefore:
        map.pickup_reminder_minutes_before ?? d.reminderMinutesBefore,
      overdueGraceMinutes:
        map.pickup_overdue_grace_minutes ?? d.overdueGraceMinutes,
      reassignmentGraceMinutes:
        map.pickup_reassignment_grace_minutes ?? d.reassignmentGraceMinutes,
      extensionMinutes: map.pickup_extension_minutes ?? d.extensionMinutes,
      geofenceMeters: map.pickup_geofence_meters ?? d.geofenceMeters,
      approachDeltaMeters:
        map.pickup_approach_delta_meters ?? d.approachDeltaMeters,
      gpsStaleMinutes: map.pickup_gps_stale_minutes ?? d.gpsStaleMinutes,
      autoReassignmentEnabled:
        (map.pickup_auto_reassignment_enabled ?? 0) === 1,
      maxReassignments: map.pickup_max_reassignments ?? d.maxReassignments,
    };
  }

  private async reconcileReminders(config: PickupMonitorConfig): Promise<void> {
    const cutoff = new Date(
      Date.now() + config.reminderMinutesBefore * 60 * 1000
    ).toISOString();
    const orders = await this.queryActive(['monitoring'], { _lte: cutoff });
    for (const order of orders) {
      await this.sendReminder(order);
    }
  }

  private async reconcileAtRisk(config: PickupMonitorConfig): Promise<void> {
    const now = new Date().toISOString();
    const orders = await this.queryActive(['monitoring', 'reminded'], {
      _lte: now,
    });
    for (const order of orders) {
      await this.escalateAtRisk(order, config);
    }
  }

  private async reconcileOverdue(config: PickupMonitorConfig): Promise<void> {
    const cutoff = new Date(
      Date.now() - config.overdueGraceMinutes * 60 * 1000
    ).toISOString();
    const orders = await this.queryActive(['at_risk'], { _lte: cutoff });
    for (const order of orders) {
      await this.escalateOverdue(order, config);
    }
  }

  private async reconcileReassignment(
    config: PickupMonitorConfig
  ): Promise<void> {
    if (!config.autoReassignmentEnabled) return;
    const cutoff = new Date(
      Date.now() - config.reassignmentGraceMinutes * 60 * 1000
    ).toISOString();
    const orders = await this.queryActive(['overdue'], { _lte: cutoff });
    for (const order of orders) {
      await this.tryReassign(order, config);
    }
  }

  private async sendReminder(order: MonitoredPickupOrder): Promise<void> {
    await this.setState(order.id, 'reminded', {
      pickup_reminder_sent_at: new Date().toISOString(),
    });
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'pickup_reminder_sent',
      actorType: 'system',
      payload: { pickupDueAt: order.pickup_due_at },
    });
    await this.notifications.sendPickupReminderPush({
      agentUserId: order.assigned_agent?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
      businessName: order.business?.name,
      pickupDueAt: order.pickup_due_at,
      preferredLanguage: order.assigned_agent?.user?.preferred_language,
    });
  }

  private async escalateAtRisk(
    order: MonitoredPickupOrder,
    config: PickupMonitorConfig
  ): Promise<void> {
    const progress = await this.progress.evaluate(order, config, {
      includeEta: true,
      remainingGraceMinutes: config.overdueGraceMinutes,
    });
    if (progress.shouldDeferEscalation) return;
    await this.setState(order.id, 'at_risk', {
      pickup_at_risk_at: new Date().toISOString(),
    });
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'pickup_at_risk',
      actorType: 'system',
      payload: { distanceMeters: progress.distanceMeters },
    });
    await this.notifyAtRisk(order);
  }

  private async escalateOverdue(
    order: MonitoredPickupOrder,
    config: PickupMonitorConfig
  ): Promise<void> {
    const remaining =
      config.reassignmentGraceMinutes - config.overdueGraceMinutes;
    const progress = await this.progress.evaluate(order, config, {
      includeEta: true,
      remainingGraceMinutes: remaining,
    });
    if (progress.shouldDeferEscalation) return;
    await this.setState(order.id, 'overdue', {
      pickup_overdue_at: new Date().toISOString(),
    });
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'pickup_overdue',
      actorType: 'system',
      payload: { distanceMeters: progress.distanceMeters },
    });
    await this.notifyOverdue(order, remaining);
  }

  private async tryReassign(
    order: MonitoredPickupOrder,
    config: PickupMonitorConfig
  ): Promise<void> {
    const progress = await this.progress.evaluate(order, config, {
      includeEta: true,
      remainingGraceMinutes: 0,
    });
    if (progress.shouldDeferEscalation) return;
    await this.reassignment.reassignOrder(order.id, 'pickup_overdue', {
      maxReassignments: config.maxReassignments,
    });
  }

  private async notifyAtRisk(order: MonitoredPickupOrder): Promise<void> {
    await this.notifications.sendPickupAtRiskAgentPush({
      agentUserId: order.assigned_agent?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.assigned_agent?.user?.preferred_language,
    });
    await this.notifications.sendPickupAtRiskBusinessPush({
      businessUserId: order.business?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: order.business?.user?.preferred_language,
    });
  }

  private async notifyOverdue(
    order: MonitoredPickupOrder,
    reassignmentInMinutes: number
  ): Promise<void> {
    await this.notifications.sendPickupOverdueAgentPush({
      agentUserId: order.assigned_agent?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
      reassignmentInMinutes,
      preferredLanguage: order.assigned_agent?.user?.preferred_language,
    });
    await this.notifications.sendPickupOverdueCustomerPush({
      clientUserId: order.client?.user_id,
      orderId: order.id,
      orderNumber: order.order_number,
      estimatedDeliveryTime: order.estimated_delivery_time,
      preferredLanguage: order.client?.user?.preferred_language,
    });
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'customer_notified_delay',
      actorType: 'system',
    });
  }

  private async queryActive(
    states: OrderPickupState[],
    dueFilter: { _lte: string }
  ): Promise<MonitoredPickupOrder[]> {
    const res = await this.hasura.executeQuery(
      `query PickupActive($states: [order_pickup_state!]!, $due: timestamptz_comparison_exp!) {
        orders(
          where: {
            current_status: { _eq: assigned_to_agent }
            pickup_state: { _in: $states }
            pickup_due_at: $due
          }
          limit: 25
        ) {
          id order_number current_status assigned_agent_id assigned_at
          pickup_by pickup_due_at pickup_state pickup_extension_minutes
          pickup_paused_at pickup_pause_reason pickup_pause_remaining_ms
          reassignment_count last_agent_distance_m last_agent_progress_at
          agent_arrived_pickup_at estimated_delivery_time business_id
          client { user_id user { preferred_language email first_name } }
          business { user_id name user { preferred_language email } }
          assigned_agent {
            id user_id user { preferred_language first_name }
          }
          business_location { id address { latitude longitude } }
        }
      }`,
      { states, due: dueFilter }
    );
    return (res.orders || []) as MonitoredPickupOrder[];
  }

  async fetchOrder(orderId: string): Promise<MonitoredPickupOrder | null> {
    const res = await this.hasura.executeQuery(
      `query PickupOrder($id: uuid!) {
        orders_by_pk(id: $id) {
          id order_number current_status assigned_agent_id assigned_at
          pickup_by pickup_due_at pickup_state pickup_extension_minutes
          pickup_paused_at pickup_pause_reason pickup_pause_remaining_ms
          reassignment_count last_agent_distance_m last_agent_progress_at
          agent_arrived_pickup_at estimated_delivery_time business_id
          client { user_id user { preferred_language email first_name } }
          business { user_id name user { preferred_language email } }
          assigned_agent {
            id user_id user { preferred_language first_name }
          }
          business_location { id address { latitude longitude } }
        }
      }`,
      { id: orderId }
    );
    return res.orders_by_pk ?? null;
  }

  private async persistMonitoringStart(
    orderId: string,
    assignedAt: Date,
    dueAt: Date
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation StartPickupMonitor(
        $id: uuid!, $assignedAt: timestamptz!, $dueAt: timestamptz!
      ) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            assigned_at: $assignedAt
            pickup_due_at: $dueAt
            pickup_state: monitoring
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
          }
        ) { id }
      }`,
      {
        id: orderId,
        assignedAt: assignedAt.toISOString(),
        dueAt: dueAt.toISOString(),
      }
    );
  }

  private async setState(
    orderId: string,
    state: OrderPickupState,
    extra: Record<string, string>
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation SetPickupState($id: uuid!, $set: orders_set_input!) {
        update_orders_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }`,
      { id: orderId, set: { pickup_state: state, ...extra } }
    );
  }

  private extendDueAt(
    order: MonitoredPickupOrder,
    minutes: number
  ): string {
    const base = order.pickup_due_at
      ? new Date(order.pickup_due_at).getTime()
      : Date.now();
    return new Date(Math.max(base, Date.now()) + minutes * 60 * 1000).toISOString();
  }

  private async persistExtension(
    orderId: string,
    dueAt: string,
    minutes: number
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation ExtendPickup($id: uuid!, $due: timestamptz!, $mins: Int!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            pickup_due_at: $due
            pickup_extension_minutes: $mins
            pickup_state: monitoring
            pickup_at_risk_at: null
            pickup_overdue_at: null
          }
        ) { id }
      }`,
      { id: orderId, due: dueAt, mins: minutes }
    );
  }

  private remainingMs(pickupDueAt?: string | null): number {
    if (!pickupDueAt) return 0;
    return Math.max(0, new Date(pickupDueAt).getTime() - Date.now());
  }

  private async persistPause(
    orderId: string,
    reason: PickupPauseReason,
    remainingMs: number,
    extraMinutes?: number
  ): Promise<void> {
    const remaining =
      remainingMs + Math.max(0, (extraMinutes || 0) * 60 * 1000);
    await this.hasura.executeMutation(
      `mutation PausePickup(
        $id: uuid!, $reason: String!, $remaining: bigint!, $at: timestamptz!
      ) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            pickup_state: paused
            pickup_paused_at: $at
            pickup_pause_reason: $reason
            pickup_pause_remaining_ms: $remaining
          }
        ) { id }
      }`,
      {
        id: orderId,
        reason,
        remaining,
        at: new Date().toISOString(),
      }
    );
  }

  private async persistResume(orderId: string, dueAt: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation ResumePickup($id: uuid!, $due: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            pickup_state: monitoring
            pickup_due_at: $due
            pickup_paused_at: null
            pickup_pause_reason: null
            pickup_pause_remaining_ms: null
            pickup_at_risk_at: null
            pickup_overdue_at: null
          }
        ) { id }
      }`,
      { id: orderId, due: dueAt }
    );
  }

  private assertAssignedAgent(
    order: MonitoredPickupOrder | null,
    agentId: string
  ): void {
    if (!order || order.current_status !== 'assigned_to_agent') {
      throw new Error('Order is not assigned');
    }
    if (order.assigned_agent_id !== agentId) {
      throw new Error('Agent is not assigned to this order');
    }
  }
}
