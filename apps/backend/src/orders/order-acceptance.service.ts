import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import {
  getDayHours,
  getDayNameForIndex,
  isSlotFullyWithinHours,
  isTimeOfDayWithinHours,
  normalizeOperatingHours,
  type DayName,
} from '../common/operating-hours.util';
import type { Configuration } from '../config/configuration';
import { DeliveryConfigService } from '../delivery-configs/delivery-configs.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DEFAULT_USER_TIMEZONE,
  isValidIanaTimezone,
  parseCalendarDatePartsFromPreferredDate,
  timezoneFromAddressCountryCode,
} from '../users/user-timezone.util';
import { OrderSystemJobsService } from './order-system-jobs.service';
import {
  ACTIVATION_LEAD_MINUTES_ALLOWED,
  CONFIRMABLE_ACCEPTANCE_STATES,
  type OrderAcceptanceState,
  type PendingAcceptanceOrder,
  type ReliabilityTier,
} from './order-acceptance.types';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

interface SlaOrder {
  id: string;
  order_number: string;
  current_status: string;
  acceptance_state: string | null;
  business_id: string;
  estimated_prep_minutes?: number | null;
  acceptance_activates_at?: string | null;
  client?: {
    user_id?: string;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      phone_number?: string | null;
      preferred_language?: string | null;
      timezone?: string | null;
    } | null;
  } | null;
  business?: {
    user_id?: string;
    name?: string;
    user?: {
      preferred_language?: string | null;
      email?: string | null;
    } | null;
  } | null;
  business_location?: { address?: { country?: string | null } | null } | null;
  delivery_address?: { country?: string | null } | null;
  delivery_time_windows?: Array<{
    preferred_date?: string | null;
    time_slot_start?: string | null;
    time_slot_end?: string | null;
    is_confirmed?: boolean | null;
  }> | null;
}

@Injectable()
export class OrderAcceptanceService {
  private readonly logger = new Logger(OrderAcceptanceService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly configService: ConfigService<Configuration>,
    private readonly waitAndExecute: WaitAndExecuteScheduleService,
    private readonly orderSystemJobs: OrderSystemJobsService,
    private readonly notifications: NotificationsService,
    private readonly deliveryConfigService: DeliveryConfigService
  ) {}

  private orderConfig(): Configuration['order'] {
    return this.configService.get('order') as Configuration['order'];
  }

  async startAcceptanceSla(orderId: string): Promise<void> {
    const order = await this.fetchOrderForSla(orderId);
    if (!order || order.current_status !== 'pending') return;
    if (order.acceptance_state === 'accepted') return;
    if (order.acceptance_state === 'awaiting_acceptance') return;
    if (order.acceptance_state === 'scheduled') return;

    const timing = await this.getBusinessTiming(order.business_id);
    const prep = timing.defaultEstimatedPrepMinutes;
    const activationAt = await this.computeActivationAt(order, prep, timing);
    if (!activationAt || activationAt.getTime() <= Date.now()) {
      const timeoutSeconds = activationAt
        ? timing.futureTimeoutSeconds
        : timing.asapTimeoutSeconds;
      await this.beginActiveAcceptanceSla(order, prep, timeoutSeconds);
      return;
    }
    await this.beginScheduledAcceptance(order, prep, activationAt);
  }

  async activateAcceptanceSla(
    orderId: string
  ): Promise<{ success: boolean; skipped?: boolean }> {
    const order = await this.fetchOrderForSla(orderId);
    if (!order || order.current_status !== 'pending') {
      return { success: true, skipped: true };
    }
    if (order.acceptance_state !== 'scheduled') {
      return { success: true, skipped: true };
    }
    const timing = await this.getBusinessTiming(order.business_id);
    const prep =
      order.estimated_prep_minutes ?? timing.defaultEstimatedPrepMinutes;
    await this.beginActiveAcceptanceSla(
      order,
      prep,
      timing.futureTimeoutSeconds,
      true
    );
    return { success: true };
  }

  async onAcceptanceDeadline(orderId: string): Promise<{ success: boolean; skipped?: boolean }> {
    const order = await this.fetchOrderForSla(orderId);
    if (!this.isPendingAwaiting(order)) {
      return { success: true, skipped: true };
    }
    const graceSec = this.orderConfig().acceptanceGraceSeconds;
    const graceDeadline = new Date(Date.now() + graceSec * 1000).toISOString();

    // no_response → grace in one step: escalate + start grace window.
    await this.hasura.executeMutation(
      `mutation EscalateAcceptance($id: uuid!, $grace: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            acceptance_state: grace
            grace_deadline_at: $grace
            updated_at: "now()"
          }
        ) { id }
      }`,
      { id: orderId, grace: graceDeadline }
    );

    await this.notifyEscalation(order!);
    await this.waitAndExecute.scheduleAcceptanceTimeout(
      'order.acceptance_grace_deadline',
      { order_id: orderId },
      graceSec
    );
    return { success: true };
  }

  async onGraceDeadline(orderId: string): Promise<{ success: boolean; skipped?: boolean }> {
    const order = await this.fetchOrderForSla(orderId);
    if (!order || order.current_status !== 'pending') {
      return { success: true, skipped: true };
    }
    const state = order.acceptance_state as OrderAcceptanceState | null;
    if (state !== 'no_response' && state !== 'grace') {
      return { success: true, skipped: true };
    }

    const declined =
      await this.orderSystemJobs.autoDeclineUnacceptedOrderAsSystem(orderId);
    if (!declined) {
      return { success: true, skipped: true };
    }
    await this.recordAutoDecline(order.business_id, orderId);
    return { success: true };
  }

  async markAccepted(orderId: string, businessId: string, createdAt: string): Promise<void> {
    const acceptedAt = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation MarkAccepted($id: uuid!, $at: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            acceptance_state: accepted
            accepted_at: $at
            acceptance_activates_at: null
            acceptance_deadline_at: null
            grace_deadline_at: null
            updated_at: $at
          }
        ) { id }
      }`,
      { id: orderId, at: acceptedAt }
    );
    const latencyMs = Math.max(
      0,
      new Date(acceptedAt).getTime() - new Date(createdAt).getTime()
    );
    await this.bumpAcceptedCounters(businessId, latencyMs);
  }

  assertConfirmableAcceptance(order: {
    current_status: string;
    acceptance_state?: string | null;
  }): void {
    if (order.current_status !== 'pending') {
      throw new HttpException(
        `Cannot confirm order in ${order.current_status} status`,
        HttpStatus.BAD_REQUEST
      );
    }
    const state = (order.acceptance_state ||
      'awaiting_acceptance') as OrderAcceptanceState;
    if (!CONFIRMABLE_ACCEPTANCE_STATES.includes(state)) {
      throw new HttpException(
        'Order is no longer awaiting merchant acceptance',
        HttpStatus.CONFLICT
      );
    }
  }

  async markBusy(orderId: string, businessUserId: string): Promise<{
    success: boolean;
    order: PendingAcceptanceOrder;
    message: string;
  }> {
    const order = await this.fetchPendingAcceptanceDetail(orderId);
    if (!order) throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
    await this.assertBusinessOwnsOrder(order.business_id, businessUserId);
    this.assertConfirmableAcceptance(order);
    if (order.acceptance_state === 'scheduled') {
      throw new HttpException(
        'Busy is only available after the confirmation timer has started',
        HttpStatus.BAD_REQUEST
      );
    }

    const cfg = this.orderConfig();
    const nextExtra = Math.min(
      cfg.busyExtraPrepCapMinutes,
      (order.busy_extra_prep_minutes || 0) + cfg.busyExtraPrepMinutes
    );
    const estimated =
      cfg.defaultEstimatedPrepMinutes + nextExtra;

    const updated = await this.hasura.executeMutation(
      `mutation MarkBusy($id: uuid!, $extra: Int!, $prep: Int!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            busy_extra_prep_minutes: $extra
            estimated_prep_minutes: $prep
            updated_at: "now()"
          }
        ) {
          id order_number acceptance_state acceptance_deadline_at
          grace_deadline_at busy_extra_prep_minutes estimated_prep_minutes
          current_status created_at total_amount currency business_id
        }
      }`,
      { id: orderId, extra: nextExtra, prep: estimated }
    );

    await this.notifyClientBusy(order, estimated);
    return {
      success: true,
      order: updated.update_orders_by_pk,
      message: 'Customer notified of higher demand',
    };
  }

  async getPendingAcceptanceForBusiness(
    businessId: string
  ): Promise<{ active: boolean; order: PendingAcceptanceOrder | null }> {
    const res = await this.hasura.executeQuery(
      `query PendingAcceptance($bid: uuid!) {
        orders(
          where: {
            business_id: { _eq: $bid }
            current_status: { _eq: pending }
            acceptance_state: { _in: [awaiting_acceptance, no_response, grace] }
          }
          order_by: { created_at: asc }
          limit: 1
        ) {
          id order_number current_status acceptance_state
          acceptance_deadline_at grace_deadline_at
          busy_extra_prep_minutes estimated_prep_minutes
          created_at total_amount currency fulfillment_method business_id
          client { user { first_name last_name } }
          order_items { item_name quantity }
        }
      }`,
      { bid: businessId }
    );
    const order = res.orders?.[0] ?? null;
    return { active: !!order, order };
  }

  async recordMerchantCancelOfPending(businessId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation BumpMerchantCancel($id: uuid!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _inc: { orders_merchant_cancelled_count: 1 }
          _set: { updated_at: "now()" }
        ) { id }
      }`,
      { id: businessId }
    );
    await this.recomputeReliability(businessId);
  }

  private mapReliabilityRow(b: {
    id: string;
    name?: string | null;
    orders_accepted_count?: number | null;
    orders_auto_declined_count?: number | null;
    orders_merchant_cancelled_count?: number | null;
    acceptance_latency_sum_ms?: number | null;
    reliability_score?: number | null;
    reliability_tier?: string | null;
    auto_decline_rolling_30d?: number | null;
    acceptance_timeout_seconds?: number | null;
    accepting_orders?: boolean | null;
    paused_until?: string | null;
    lifecycle_status?: string | null;
    user?: {
      id?: string;
      email?: string | null;
      phone_number?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  }) {
    const accepted = b.orders_accepted_count || 0;
    const auto = b.orders_auto_declined_count || 0;
    const cancelled = b.orders_merchant_cancelled_count || 0;
    const denom = accepted + auto + cancelled;
    const avgSec =
      accepted > 0
        ? Math.round((b.acceptance_latency_sum_ms || 0) / accepted / 1000)
        : null;
    return {
      ...b,
      acceptanceRatePct: denom ? Math.round((accepted / denom) * 1000) / 10 : 100,
      autoDeclineRatePct: denom ? Math.round((auto / denom) * 1000) / 10 : 0,
      merchantCancelRatePct: denom
        ? Math.round((cancelled / denom) * 1000) / 10
        : 0,
      averageAcceptanceSeconds: avgSec,
    };
  }

  async getReliability(businessId: string) {
    const res = await this.hasura.executeQuery(
      `query BizReliability($id: uuid!) {
        businesses_by_pk(id: $id) {
          id name
          orders_accepted_count
          orders_auto_declined_count
          orders_merchant_cancelled_count
          acceptance_latency_sum_ms
          reliability_score
          reliability_tier
          auto_decline_rolling_30d
          acceptance_timeout_seconds
          accepting_orders
          paused_until
        }
      }`,
      { id: businessId }
    );
    const b = res.businesses_by_pk;
    if (!b) throw new HttpException('Business not found', HttpStatus.NOT_FOUND);
    return this.mapReliabilityRow(b);
  }

  async listLeastReliableBusinesses(params: {
    limit?: number;
    tier?: string;
    minAutoDeclines30d?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const where: Record<string, unknown> = {};
    if (params.tier?.trim()) {
      where.reliability_tier = { _eq: params.tier.trim() };
    }
    if (
      params.minAutoDeclines30d != null &&
      Number.isFinite(params.minAutoDeclines30d)
    ) {
      where.auto_decline_rolling_30d = {
        _gte: Math.max(0, Math.floor(params.minAutoDeclines30d)),
      };
    }

    const res = await this.hasura.executeQuery(
      `query LeastReliableBusinesses($where: businesses_bool_exp!, $limit: Int!) {
        businesses(
          where: $where
          order_by: [
            { reliability_score: asc_nulls_last }
            { auto_decline_rolling_30d: desc }
          ]
          limit: $limit
        ) {
          id name
          lifecycle_status
          orders_accepted_count
          orders_auto_declined_count
          orders_merchant_cancelled_count
          acceptance_latency_sum_ms
          reliability_score
          reliability_tier
          auto_decline_rolling_30d
          acceptance_timeout_seconds
          accepting_orders
          paused_until
          user {
            id
            email
            phone_number
            first_name
            last_name
          }
        }
      }`,
      { where, limit }
    );
    const rows = (res.businesses || []) as Array<{
      id: string;
      auto_decline_rolling_30d?: number | null;
    }>;
    const businesses = await Promise.all(
      rows.map(async (row) => {
        const rolling = await this.refreshRollingAutoDeclines(row.id).catch(
          () => row.auto_decline_rolling_30d ?? 0
        );
        return this.mapReliabilityRow({
          ...row,
          auto_decline_rolling_30d: rolling,
        });
      })
    );
    return { businesses };
  }

  async pauseBusiness(
    businessId: string,
    duration: '15m' | '1h' | 'until_tomorrow' | 'indefinite'
  ): Promise<void> {
    const pausedUntil = this.resolvePauseUntil(duration);
    await this.hasura.executeMutation(
      `mutation PauseBiz($id: uuid!, $until: timestamptz) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: {
            accepting_orders: false
            paused_until: $until
            updated_at: "now()"
          }
        ) { id }
      }`,
      { id: businessId, until: pausedUntil }
    );
  }

  async resumeBusiness(businessId: string): Promise<void> {
    await this.hasura.executeMutation(
      `mutation ResumeBiz($id: uuid!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: {
            accepting_orders: true
            paused_until: null
            updated_at: "now()"
          }
        ) { id }
      }`,
      { id: businessId }
    );
  }

  async isBusinessAcceptingOrders(businessId: string): Promise<boolean> {
    const res = await this.hasura.executeQuery(
      `query BizAccepting($id: uuid!) {
        businesses_by_pk(id: $id) {
          can_accept_orders
          accepting_orders
          paused_until
          lifecycle_status
        }
      }`,
      { id: businessId }
    );
    const b = res.businesses_by_pk;
    if (!b) return false;
    if (!b.can_accept_orders || b.lifecycle_status === 'suspended') return false;
    if (b.paused_until) {
      const until = new Date(b.paused_until).getTime();
      if (Date.now() < until) return false;
      if (!b.accepting_orders) {
        await this.resumeBusiness(businessId);
        return true;
      }
    }
    return !!b.accepting_orders;
  }

  async updateLocationHours(
    locationId: string,
    businessId: string,
    operatingHours: Record<string, unknown>
  ): Promise<void> {
    const res = await this.hasura.executeQuery(
      `query Loc($id: uuid!) {
        business_locations_by_pk(id: $id) { id business_id }
      }`,
      { id: locationId }
    );
    const loc = res.business_locations_by_pk;
    if (!loc || loc.business_id !== businessId) {
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
    }
    await this.hasura.executeMutation(
      `mutation SetHours($id: uuid!, $hours: jsonb!) {
        update_business_locations_by_pk(
          pk_columns: { id: $id }
          _set: { operating_hours: $hours, updated_at: "now()" }
        ) { id }
      }`,
      { id: locationId, hours: operatingHours }
    );
  }

  isWithinOperatingHours(
    operatingHours: unknown,
    now = new Date()
  ): boolean {
    const normalized = normalizeOperatingHours(operatingHours);
    if (!normalized) return true;
    const dayName = getDayNameForIndex(now.getDay());
    const dayHours = getDayHours(normalized, dayName);
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    return isTimeOfDayWithinHours(dayHours, minutesSinceMidnight);
  }

  /**
   * Whether a calendar date + slot [start, end) falls fully within operating hours.
   * `preferredDate` is YYYY-MM-DD (timezone-independent day-of-week).
   */
  isSlotWithinOperatingHours(
    operatingHours: unknown,
    preferredDate: string,
    slotStartTime: string,
    slotEndTime: string
  ): boolean {
    const normalized = normalizeOperatingHours(operatingHours);
    if (!normalized) return true;
    const dayName = this.getDayNameForCalendarDate(preferredDate);
    const dayHours = getDayHours(normalized, dayName);
    return isSlotFullyWithinHours(dayHours, slotStartTime, slotEndTime);
  }

  getDayNameForCalendarDate(preferredDate: string): DayName {
    const [year, month, day] = preferredDate.split('-').map(Number);
    return getDayNameForIndex(new Date(year, month - 1, day).getDay());
  }

  async fetchDeliverySlotTimes(
    slotId: string
  ): Promise<{ start_time: string; end_time: string } | null> {
    const res = await this.hasura.executeQuery(
      `query SlotTimes($id: uuid!) {
        delivery_time_slots_by_pk(id: $id) {
          start_time
          end_time
          is_active
        }
      }`,
      { id: slotId }
    );
    const slot = res.delivery_time_slots_by_pk;
    if (!slot?.is_active || !slot.start_time || !slot.end_time) return null;
    return { start_time: slot.start_time, end_time: slot.end_time };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileAcceptanceDeadlines(): Promise<void> {
    try {
      await this.reconcileDueActivations();
      await this.reconcileExpiredAcceptances();
      await this.reconcileExpiredGraces();
      await this.clearExpiredPauses();
    } catch (error: any) {
      this.logger.error(`Acceptance reconciler failed: ${error?.message}`);
    }
  }

  private async reconcileDueActivations(): Promise<void> {
    const res = await this.hasura.executeQuery(
      `query DueActivation($now: timestamptz!) {
        orders(
          where: {
            current_status: { _eq: pending }
            acceptance_state: { _eq: scheduled }
            acceptance_activates_at: { _lte: $now }
          }
          limit: 25
        ) { id }
      }`,
      { now: new Date().toISOString() }
    );
    for (const row of res.orders || []) {
      try {
        await this.activateAcceptanceSla(row.id);
      } catch (err: any) {
        this.logger.warn(`reconcileDueActivations: failed to activate order ${row.id}: ${err?.message}`);
      }
    }
  }

  private async reconcileExpiredAcceptances(): Promise<void> {
    const res = await this.hasura.executeQuery(
      `query ExpiredAccept($now: timestamptz!) {
        orders(
          where: {
            current_status: { _eq: pending }
            acceptance_state: { _eq: awaiting_acceptance }
            acceptance_deadline_at: { _lte: $now }
          }
          limit: 25
        ) { id }
      }`,
      { now: new Date().toISOString() }
    );
    for (const row of res.orders || []) {
      await this.onAcceptanceDeadline(row.id);
    }
  }

  private async reconcileExpiredGraces(): Promise<void> {
    const res = await this.hasura.executeQuery(
      `query ExpiredGrace($now: timestamptz!) {
        orders(
          where: {
            current_status: { _eq: pending }
            acceptance_state: { _in: [no_response, grace] }
            grace_deadline_at: { _lte: $now }
          }
          limit: 25
        ) { id }
      }`,
      { now: new Date().toISOString() }
    );
    for (const row of res.orders || []) {
      await this.onGraceDeadline(row.id);
    }
  }

  private async clearExpiredPauses(): Promise<void> {
    await this.hasura.executeMutation(
      `mutation ClearPauses($now: timestamptz!) {
        update_businesses(
          where: {
            accepting_orders: { _eq: false }
            paused_until: { _lte: $now }
          }
          _set: { accepting_orders: true, paused_until: null, updated_at: "now()" }
        ) { affected_rows }
      }`,
      { now: new Date().toISOString() }
    );
  }

  private resolvePauseUntil(
    duration: '15m' | '1h' | 'until_tomorrow' | 'indefinite'
  ): string | null {
    if (duration === 'indefinite') return null;
    const now = new Date();
    if (duration === '15m') {
      return new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    }
    if (duration === '1h') {
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  private isPendingAwaiting(
    order: { current_status: string; acceptance_state?: string | null } | null
  ): boolean {
    return (
      !!order &&
      order.current_status === 'pending' &&
      order.acceptance_state === 'awaiting_acceptance'
    );
  }

  async getAcceptanceTimeoutSeconds(businessId: string): Promise<number> {
    const timing = await this.getBusinessTiming(businessId);
    return timing.asapTimeoutSeconds;
  }

  async getOrderTiming(businessId: string) {
    const timing = await this.getBusinessTiming(businessId);
    const cfg = this.orderConfig();
    return {
      acceptance_timeout_seconds: timing.raw.acceptance_timeout_seconds,
      future_acceptance_timeout_seconds:
        timing.raw.future_acceptance_timeout_seconds,
      order_activation_lead_minutes: timing.raw.order_activation_lead_minutes,
      default_estimated_prep_minutes: timing.raw.default_estimated_prep_minutes,
      effective: {
        acceptance_timeout_seconds: timing.asapTimeoutSeconds,
        future_acceptance_timeout_seconds: timing.futureTimeoutSeconds,
        order_activation_lead_minutes: timing.activationLeadMinutes,
        default_estimated_prep_minutes: timing.defaultEstimatedPrepMinutes,
      },
      defaults: {
        acceptance_timeout_seconds: cfg.acceptanceTimeoutSeconds,
        future_acceptance_timeout_seconds: cfg.futureAcceptanceTimeoutSeconds,
        order_activation_lead_minutes: cfg.orderActivationLeadMinutes,
        default_estimated_prep_minutes: cfg.defaultEstimatedPrepMinutes,
      },
      activation_lead_choices: [...ACTIVATION_LEAD_MINUTES_ALLOWED],
    };
  }

  async updateOrderTiming(
    businessId: string,
    body: {
      acceptance_timeout_seconds?: number | null;
      future_acceptance_timeout_seconds?: number | null;
      order_activation_lead_minutes?: number | null;
      default_estimated_prep_minutes?: number | null;
    }
  ): Promise<void> {
    const set: Record<string, number | null> = {};
    this.assignOptionalPositiveSeconds(
      set,
      'acceptance_timeout_seconds',
      body.acceptance_timeout_seconds
    );
    this.assignOptionalPositiveSeconds(
      set,
      'future_acceptance_timeout_seconds',
      body.future_acceptance_timeout_seconds
    );
    this.assignOptionalActivationLead(
      set,
      body.order_activation_lead_minutes
    );
    this.assignOptionalPositiveMinutes(
      set,
      'default_estimated_prep_minutes',
      body.default_estimated_prep_minutes
    );
    if (Object.keys(set).length === 0) {
      throw new HttpException('No timing fields provided', HttpStatus.BAD_REQUEST);
    }
    await this.hasura.executeMutation(
      `mutation UpdateOrderTiming($id: uuid!, $set: businesses_set_input!) {
        update_businesses_by_pk(pk_columns: { id: $id }, _set: $set) { id }
      }`,
      {
        id: businessId,
        set: { ...set, updated_at: new Date().toISOString() },
      }
    );
  }

  private assignOptionalPositiveSeconds(
    set: Record<string, number | null>,
    key: string,
    value: number | null | undefined
  ): void {
    if (value === undefined) return;
    if (value === null) {
      set[key] = null;
      return;
    }
    if (!Number.isFinite(value) || value < 60 || value > 3600) {
      throw new HttpException(
        `${key} must be between 60 and 3600 seconds`,
        HttpStatus.BAD_REQUEST
      );
    }
    set[key] = Math.round(value);
  }

  private assignOptionalActivationLead(
    set: Record<string, number | null>,
    value: number | null | undefined
  ): void {
    if (value === undefined) return;
    if (value === null) {
      set.order_activation_lead_minutes = null;
      return;
    }
    if (
      !(ACTIVATION_LEAD_MINUTES_ALLOWED as readonly number[]).includes(value)
    ) {
      throw new HttpException(
        'order_activation_lead_minutes must be 30, 60, or 120',
        HttpStatus.BAD_REQUEST
      );
    }
    set.order_activation_lead_minutes = value;
  }

  private assignOptionalPositiveMinutes(
    set: Record<string, number | null>,
    key: string,
    value: number | null | undefined
  ): void {
    if (value === undefined) return;
    if (value === null) {
      set[key] = null;
      return;
    }
    if (!Number.isFinite(value) || value < 5 || value > 240) {
      throw new HttpException(
        `${key} must be between 5 and 240 minutes`,
        HttpStatus.BAD_REQUEST
      );
    }
    set[key] = Math.round(value);
  }

  async getBusinessTiming(businessId: string): Promise<{
    asapTimeoutSeconds: number;
    futureTimeoutSeconds: number;
    activationLeadMinutes: number;
    defaultEstimatedPrepMinutes: number;
    raw: {
      acceptance_timeout_seconds: number | null;
      future_acceptance_timeout_seconds: number | null;
      order_activation_lead_minutes: number | null;
      default_estimated_prep_minutes: number | null;
    };
  }> {
    const cfg = this.orderConfig();
    const res = await this.hasura.executeQuery(
      `query BizTiming($id: uuid!) {
        businesses_by_pk(id: $id) {
          acceptance_timeout_seconds
          future_acceptance_timeout_seconds
          order_activation_lead_minutes
          default_estimated_prep_minutes
        }
      }`,
      { id: businessId }
    );
    const b = res.businesses_by_pk || {};
    const asap =
      typeof b.acceptance_timeout_seconds === 'number' &&
      b.acceptance_timeout_seconds > 0
        ? b.acceptance_timeout_seconds
        : cfg.acceptanceTimeoutSeconds;
    const future =
      typeof b.future_acceptance_timeout_seconds === 'number' &&
      b.future_acceptance_timeout_seconds > 0
        ? b.future_acceptance_timeout_seconds
        : cfg.futureAcceptanceTimeoutSeconds;
    const lead =
      typeof b.order_activation_lead_minutes === 'number' &&
      b.order_activation_lead_minutes > 0
        ? b.order_activation_lead_minutes
        : cfg.orderActivationLeadMinutes;
    const prep =
      typeof b.default_estimated_prep_minutes === 'number' &&
      b.default_estimated_prep_minutes > 0
        ? b.default_estimated_prep_minutes
        : cfg.defaultEstimatedPrepMinutes;
    return {
      asapTimeoutSeconds: asap,
      futureTimeoutSeconds: future,
      activationLeadMinutes: lead,
      defaultEstimatedPrepMinutes: prep,
      raw: {
        acceptance_timeout_seconds: b.acceptance_timeout_seconds ?? null,
        future_acceptance_timeout_seconds:
          b.future_acceptance_timeout_seconds ?? null,
        order_activation_lead_minutes: b.order_activation_lead_minutes ?? null,
        default_estimated_prep_minutes: b.default_estimated_prep_minutes ?? null,
      },
    };
  }

  private async beginActiveAcceptanceSla(
    order: SlaOrder,
    prep: number,
    timeoutSec: number,
    fromScheduled = false
  ): Promise<void> {
    const deadline = new Date(Date.now() + timeoutSec * 1000).toISOString();
    await this.hasura.executeMutation(
      `mutation BeginActiveSla(
        $id: uuid!, $deadline: timestamptz!, $prep: Int!
      ) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            acceptance_state: awaiting_acceptance
            acceptance_deadline_at: $deadline
            acceptance_activates_at: null
            grace_deadline_at: null
            estimated_prep_minutes: $prep
            busy_extra_prep_minutes: 0
            updated_at: "now()"
          }
        ) { id }
      }`,
      { id: order.id, deadline, prep }
    );
    await this.waitAndExecute.scheduleAcceptanceTimeout(
      'order.acceptance_deadline',
      { order_id: order.id },
      timeoutSec
    );
    if (fromScheduled) {
      await this.notifyAcceptanceActivate(order, timeoutSec);
    }
    this.logger.log(
      `Started acceptance SLA for ${order.order_number} (${timeoutSec}s)`
    );
  }

  private async beginScheduledAcceptance(
    order: SlaOrder,
    prep: number,
    activationAt: Date
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation BeginScheduledSla(
        $id: uuid!, $activates: timestamptz!, $prep: Int!
      ) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            acceptance_state: scheduled
            acceptance_activates_at: $activates
            acceptance_deadline_at: null
            grace_deadline_at: null
            estimated_prep_minutes: $prep
            busy_extra_prep_minutes: 0
            updated_at: "now()"
          }
        ) { id }
      }`,
      { id: order.id, activates: activationAt.toISOString(), prep }
    );
    const waitSeconds = Math.max(
      1,
      Math.round((activationAt.getTime() - Date.now()) / 1000)
    );
    await this.waitAndExecute.scheduleAcceptanceTimeout(
      'order.acceptance_activate',
      { order_id: order.id },
      waitSeconds
    );
    this.logger.log(
      `Scheduled acceptance for ${order.order_number} at ${activationAt.toISOString()}`
    );
  }

  private async computeActivationAt(
    order: SlaOrder,
    prepMinutes: number,
    timing: { activationLeadMinutes: number }
  ): Promise<Date | null> {
    const window = order.delivery_time_windows?.[0];
    if (!window?.preferred_date || !window.time_slot_start) return null;
    const timezone = await this.resolveOrderTimezone(order);
    const [h, m] = window.time_slot_start.split(':').map(Number);
    const readiness = this.createDateTimeInTimezone(
      window.preferred_date,
      h,
      m || 0,
      timezone
    );
    const prepMs = prepMinutes * 60 * 1000;
    const leadMs = timing.activationLeadMinutes * 60 * 1000;
    return new Date(readiness.getTime() - prepMs - leadMs);
  }

  private async resolveOrderTimezone(order: SlaOrder): Promise<string> {
    const clientTz = order.client?.user?.timezone;
    if (clientTz && isValidIanaTimezone(clientTz)) return clientTz;
    const country =
      order.business_location?.address?.country ||
      order.delivery_address?.country ||
      'GA';
    const configTz = await this.deliveryConfigService.getTimezone(country);
    if (configTz && isValidIanaTimezone(configTz)) return configTz;
    const fromCountry = timezoneFromAddressCountryCode(country);
    if (isValidIanaTimezone(fromCountry)) return fromCountry;
    return DEFAULT_USER_TIMEZONE;
  }

  private createDateTimeInTimezone(
    preferredDate: string,
    hours: number,
    minutes: number,
    timezone: string
  ): Date {
    const { year, month, day } =
      parseCalendarDatePartsFromPreferredDate(preferredDate);
    const dt = DateTime.fromObject(
      { year, month, day, hour: hours, minute: minutes, second: 0 },
      { zone: timezone }
    );
    if (!dt.isValid) {
      throw new Error(`Invalid datetime: ${dt.invalidReason}`);
    }
    return dt.toUTC().toJSDate();
  }

  private async notifyAcceptanceActivate(
    order: SlaOrder,
    timeoutSec: number
  ): Promise<void> {
    try {
      await this.notifications.sendOrderAcceptanceActivatePush({
        businessUserId: order.business?.user_id,
        orderId: order.id,
        orderNumber: order.order_number,
        preferredLanguage: order.business?.user?.preferred_language,
        acceptanceTimeoutSeconds: timeoutSec,
        clientName: `${order.client?.user?.first_name || ''} ${
          order.client?.user?.last_name || ''
        }`.trim(),
      });
    } catch (error: any) {
      this.logger.error(`Activate notify failed: ${error?.message}`);
    }
  }

  private async fetchOrderForSla(orderId: string): Promise<SlaOrder | null> {
    const res = await this.hasura.executeQuery(
      `query OrderSla($id: uuid!) {
        orders_by_pk(id: $id) {
          id order_number current_status acceptance_state business_id
          estimated_prep_minutes acceptance_activates_at
          client {
            user_id
            user {
              first_name last_name email phone_number
              preferred_language timezone
            }
          }
          business {
            user_id name
            user { preferred_language email }
          }
          business_location { address { country } }
          delivery_address { country }
          delivery_time_windows(
            order_by: { created_at: desc }
            limit: 1
          ) {
            preferred_date
            time_slot_start
            time_slot_end
            is_confirmed
          }
        }
      }`,
      { id: orderId }
    );
    return res.orders_by_pk;
  }

  private async fetchPendingAcceptanceDetail(
    orderId: string
  ): Promise<PendingAcceptanceOrder | null> {
    const res = await this.hasura.executeQuery(
      `query OrderAcceptDetail($id: uuid!) {
        orders_by_pk(id: $id) {
          id order_number current_status acceptance_state
          acceptance_deadline_at grace_deadline_at
          busy_extra_prep_minutes estimated_prep_minutes
          created_at total_amount currency fulfillment_method business_id
          client { user { first_name last_name } }
          order_items { item_name quantity }
        }
      }`,
      { id: orderId }
    );
    return res.orders_by_pk;
  }

  private async assertBusinessOwnsOrder(
    businessId: string,
    userId: string
  ): Promise<void> {
    const res = await this.hasura.executeQuery(
      `query Own($id: uuid!) {
        businesses_by_pk(id: $id) { user_id }
      }`,
      { id: businessId }
    );
    if (res.businesses_by_pk?.user_id !== userId) {
      throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
    }
  }

  private async notifyEscalation(order: {
    id: string;
    order_number: string;
    business?: {
      user_id?: string;
      name?: string;
      user?: { preferred_language?: string | null } | null;
    } | null;
  }): Promise<void> {
    try {
      await this.notifications.sendOrderAcceptanceEscalationPush({
        businessUserId: order.business?.user_id,
        orderId: order.id,
        orderNumber: order.order_number,
        preferredLanguage: order.business?.user?.preferred_language,
        graceSeconds: this.orderConfig().acceptanceGraceSeconds,
      });
      this.logger.warn(
        `Order ${order.order_number} escalated: merchant no response (admin alert via reliability dashboard)`
      );
    } catch (error: any) {
      this.logger.error(`Escalation notify failed: ${error?.message}`);
    }
  }

  private async notifyClientBusy(
    order: PendingAcceptanceOrder,
    estimatedPrepMinutes: number
  ): Promise<void> {
    try {
      const detail = await this.fetchOrderForSla(order.id);
      await this.notifications.sendOrderBusyPush({
        clientUserId: detail?.client?.user_id,
        orderId: order.id,
        orderNumber: order.order_number,
        estimatedPrepMinutes,
        preferredLanguage: detail?.client?.user?.preferred_language,
      });
    } catch (error: any) {
      this.logger.error(`Busy notify failed: ${error?.message}`);
    }
  }

  private async bumpAcceptedCounters(
    businessId: string,
    latencyMs: number
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation BumpAccepted($id: uuid!, $ms: bigint!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _inc: { orders_accepted_count: 1, acceptance_latency_sum_ms: $ms }
          _set: { updated_at: "now()" }
        ) { id }
      }`,
      { id: businessId, ms: latencyMs }
    );
    await this.recomputeReliability(businessId);
  }

  private async recordAutoDecline(
    businessId: string,
    orderId: string
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation BumpAutoDecline($id: uuid!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _inc: { orders_auto_declined_count: 1 }
          _set: { updated_at: "now()" }
        ) { id }
      }`,
      { id: businessId }
    );
    const reliability = await this.recomputeReliability(businessId);
    if (reliability.auto_decline_rolling_30d === 1) {
      await this.sendFirstMissReminder(businessId, orderId);
    }
    if (reliability.tier === 'suspend') {
      await this.suspendBusinessForReliability(businessId);
    }
  }

  /** Live 30-day auto-decline count from orders (decays as old rows age out). */
  private async refreshRollingAutoDeclines(businessId: string): Promise<number> {
    const since = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const res = await this.hasura.executeQuery(
      `query RollingAutoDeclines($bid: uuid!, $since: timestamptz!) {
        orders_aggregate(
          where: {
            business_id: { _eq: $bid }
            cancelled_by: { _eq: "system" }
            cancellation_reason_id: { _eq: 19 }
            cancelled_at: { _gte: $since }
          }
        ) { aggregate { count } }
      }`,
      { bid: businessId, since }
    );
    const count = res.orders_aggregate?.aggregate?.count ?? 0;
    await this.hasura.executeMutation(
      `mutation SetRolling($id: uuid!, $n: Int!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: { auto_decline_rolling_30d: $n, updated_at: "now()" }
        ) { id }
      }`,
      { id: businessId, n: count }
    );
    return count;
  }

  private async suspendBusinessForReliability(businessId: string): Promise<void> {
    try {
      await this.hasura.executeMutation(
        `mutation SuspendBiz($id: uuid!) {
          update_businesses_by_pk(
            pk_columns: { id: $id }
            _set: { lifecycle_status: suspended, updated_at: "now()" }
          ) { id }
        }`,
        { id: businessId }
      );
      this.logger.warn(`Suspended business ${businessId} for acceptance misses`);
    } catch (error: any) {
      this.logger.error(`Suspend after auto-declines failed: ${error?.message}`);
    }
  }

  private async sendFirstMissReminder(
    businessId: string,
    orderId: string
  ): Promise<void> {
    const biz = await this.hasura.executeQuery(
      `query BizUser($id: uuid!) {
        businesses_by_pk(id: $id) {
          user_id name
          user { preferred_language email }
        }
      }`,
      { id: businessId }
    );
    const order = await this.hasura.executeQuery(
      `query OrdNum($id: uuid!) {
        orders_by_pk(id: $id) { order_number }
      }`,
      { id: orderId }
    );
    const b = biz.businesses_by_pk;
    if (!b?.user_id) return;
    await this.notifications.sendMerchantMissedOrderReminder({
      businessUserId: b.user_id,
      orderId,
      orderNumber: order.orders_by_pk?.order_number || '',
      preferredLanguage: b.user?.preferred_language,
    });
  }

  private async recomputeReliability(businessId: string): Promise<{
    tier: ReliabilityTier;
    auto_decline_rolling_30d: number;
  }> {
    const rolling = await this.refreshRollingAutoDeclines(businessId);
    const res = await this.hasura.executeQuery(
      `query RelInputs($id: uuid!) {
        businesses_by_pk(id: $id) {
          orders_accepted_count
          orders_auto_declined_count
          orders_merchant_cancelled_count
          auto_decline_rolling_30d
        }
      }`,
      { id: businessId }
    );
    const b = res.businesses_by_pk;
    const accepted = b?.orders_accepted_count || 0;
    const auto = b?.orders_auto_declined_count || 0;
    const cancelled = b?.orders_merchant_cancelled_count || 0;
    const denom = Math.max(1, accepted + auto + cancelled);
    const acceptRate = accepted / denom;
    const autoRate = auto / denom;
    const score = Math.max(
      0,
      Math.min(100, Math.round(acceptRate * 100 - autoRate * 40 - (cancelled / denom) * 20))
    );
    const tier = this.resolveTier(rolling, autoRate, denom);
    await this.hasura.executeMutation(
      `mutation SetRel($id: uuid!, $score: numeric!, $tier: String!) {
        update_businesses_by_pk(
          pk_columns: { id: $id }
          _set: { reliability_score: $score, reliability_tier: $tier, updated_at: "now()" }
        ) { id }
      }`,
      { id: businessId, score, tier }
    );
    return { tier, auto_decline_rolling_30d: rolling };
  }

  private resolveTier(
    rolling: number,
    autoRate: number,
    denom: number
  ): ReliabilityTier {
    const cfg = this.orderConfig();
    if (
      rolling >= cfg.reliabilitySuspendAutoDeclines ||
      (denom >= 10 && autoRate >= 0.35)
    ) {
      return 'suspend';
    }
    if (
      rolling >= cfg.reliabilityRestrictAutoDeclines ||
      (denom >= 10 && autoRate >= 0.2)
    ) {
      return 'restrict';
    }
    if (
      rolling >= cfg.reliabilityDemoteAutoDeclines ||
      (denom >= 10 && autoRate >= 0.1)
    ) {
      return 'demote';
    }
    if (rolling >= 1) return 'warn';
    return 'ok';
  }
}
