import { HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { DedicatedAgentsConfigService } from '../dedicated-agents/dedicated-agents-config.service';
import {
  DedicatedCoverageService,
  type DedicatedEligibleAgent,
  type ResolvedDedicatedSlot,
} from '../dedicated-agents/dedicated-coverage.service';
import { isDedicatedEligibleOrder } from '../dedicated-agents/dedicated-eligibility.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  buildDedicatedHeadsUpMessage,
  DEDICATED_ORDER_HEADS_UP_MESSAGE_TYPE,
} from '../notifications/dedicated-order-push.messages';
import { NotificationsService } from '../notifications/notifications.service';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { isoCountryCode } from './delivery-pricing.util';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

/** The optional re-ping goes out this long before dispatch_ready_at (10-15 min band). */
export const HEADS_UP_REPING_LEAD_MINUTES = 12;
/** No re-ping when it would land within this long of the first heads-up. */
const MIN_REPING_GAP_SECONDS = 5 * 60;
/** SFN timing slack for the re-ping callback. */
const EARLY_SLACK_SECONDS = 120;

export type HeadsUpOutcome =
  | { kind: 'sent'; agentIds: string[] }
  | {
      kind: 'skipped';
      reason:
        | 'not_found'
        | 'not_dispatchable'
        | 'not_covered'
        | 'flag_off'
        | 'gate_open'
        | 'no_slot'
        | 'no_agents'
        | 'already_sent'
        | 'stale';
    };

export type HeadsUpStatus = 'sent' | 'unavailable';

interface HeadsUpOrder {
  id: string;
  order_number: string;
  business_id: string;
  business_location_id: string;
  current_status: string;
  assigned_agent_id: string | null;
  fulfillment_method: string | null;
  fulfillment_timing: string | null;
  subtotal: number | string | null;
  currency: string;
  verified_agent_delivery: boolean | null;
  coverage_slot_key: string | null;
  dispatch_ready_at: string | null;
  business?: { name?: string | null } | null;
  business_location?: { name?: string | null; address?: { country?: string | null } | null } | null;
  delivery_time_windows?: Array<{
    slot_id: string | null;
    preferred_date: string | null;
    is_confirmed: boolean | null;
  }>;
}

interface HeadsUpRow {
  agent_id: string;
  user_id: string | null;
  status: HeadsUpStatus;
  reping_sent_at: string | null;
}

const HEADS_UP_ORDER_QUERY = `
  query DedicatedHeadsUpOrder($orderId: uuid!) {
    orders_by_pk(id: $orderId) {
      id
      order_number
      business_id
      business_location_id
      current_status
      assigned_agent_id
      fulfillment_method
      fulfillment_timing
      subtotal
      currency
      verified_agent_delivery
      coverage_slot_key
      dispatch_ready_at
      business { name }
      business_location { name address { country } }
      delivery_time_windows(order_by: { created_at: desc }, limit: 1) {
        slot_id
        preferred_date
        is_confirmed
      }
    }
    dedicated_order_heads_ups(where: { order_id: { _eq: $orderId } }) {
      agent_id
      user_id
      status
      reping_sent_at
    }
  }
`;

/** Claim the one heads-up per order and agent: conflicting rows come back empty. */
const CLAIM_HEADS_UPS = `
  mutation ClaimDedicatedHeadsUps($objects: [dedicated_order_heads_ups_insert_input!]!) {
    insert_dedicated_order_heads_ups(
      objects: $objects
      on_conflict: { constraint: dedicated_order_heads_ups_pkey, update_columns: [] }
    ) {
      returning { agent_id }
    }
  }
`;

const CLAIM_REPING = `
  mutation ClaimDedicatedHeadsUpReping($orderId: uuid!, $agentIds: [uuid!]!, $now: timestamptz!) {
    update_dedicated_order_heads_ups(
      where: {
        order_id: { _eq: $orderId }
        agent_id: { _in: $agentIds }
        status: { _eq: "sent" }
        reping_sent_at: { _is_null: true }
      }
      _set: { reping_sent_at: $now }
    ) {
      returning { agent_id }
    }
  }
`;

const MARK_UNAVAILABLE = `
  mutation MarkDedicatedHeadsUpUnavailable($orderId: uuid!, $agentId: uuid!, $now: timestamptz!) {
    update_dedicated_order_heads_ups(
      where: { order_id: { _eq: $orderId }, agent_id: { _eq: $agentId } }
      _set: { status: "unavailable", responded_at: $now }
    ) {
      returning { agent_id status }
    }
  }
`;

const AGENT_HEADS_UP_QUERY = `
  query AgentDedicatedHeadsUp($orderId: uuid!, $userId: uuid!) {
    dedicated_order_heads_ups(
      where: { order_id: { _eq: $orderId }, agent: { user_id: { _eq: $userId } } }
    ) {
      agent_id
      status
      order { current_status assigned_agent_id dispatch_ready_at }
    }
  }
`;

const LOCALES_QUERY = `
  query DedicatedHeadsUpLocales($userIds: [uuid!]!) {
    users(where: { id: { _in: $userIds } }) {
      id
      preferred_language
    }
  }
`;

/**
 * Early dedicated-agent heads-up. When a scheduled order placed on dedicated
 * coverage (confirmed window, flag on) becomes ready_for_pickup while its
 * dispatch gate is still in the future, every dedicated agent eligible for the
 * slot right now (AC-E2: not paused / off today / at capacity / unsigned...)
 * gets ONE soft push: "you may get this later". It is not an offer and cannot
 * be claimed. The agent can answer "Can't take it", which marks them
 * unavailable for that order: the dedicated fallback then skips them, so
 * dispatch goes straight to the open market when nobody is left. One optional
 * re-ping goes out HEADS_UP_REPING_LEAD_MINUTES before dispatch_ready_at to
 * agents who haven't answered and are still eligible. Never throws on the
 * send paths.
 */
@Injectable()
export class DedicatedHeadsUpService {
  private readonly logger = new Logger(DedicatedHeadsUpService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly dedicatedConfig: DedicatedAgentsConfigService,
    private readonly coverage: DedicatedCoverageService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly notificationsService: NotificationsService,
    private readonly waitAndExecuteScheduleService: WaitAndExecuteScheduleService,
    @Optional()
    private readonly siteEventsService?: SiteEventsService
  ) {}

  /** After ready_for_pickup. */
  async sendForOrder(orderId: string, now: Date = new Date()): Promise<HeadsUpOutcome> {
    try {
      const ctx = await this.loadContext(orderId, now);
      if ('skip' in ctx) return { kind: 'skipped', reason: ctx.skip };
      const { order, rows, slot, gateAt } = ctx;
      const already = new Set(rows.map((r) => r.agent_id));
      const targets = (await this.eligibleAgents(order, slot)).filter((a) => !already.has(a.agentId));
      if (targets.length === 0) {
        return { kind: 'skipped', reason: rows.length > 0 ? 'already_sent' : 'no_agents' };
      }
      const claimed = await this.claim(order.id, targets);
      const sent = targets.filter((a) => claimed.has(a.agentId));
      if (sent.length === 0) return { kind: 'skipped', reason: 'already_sent' };
      await this.push(order, slot, sent, false);
      for (const a of sent) {
        emitServerSiteEvent(this.siteEventsService, 'dedicated.heads_up_sent', {
          orderId: order.id,
          agentId: a.agentId,
          assignmentId: a.assignmentId,
          slotKey: slot.slotKey,
          slotDate: slot.date,
          dispatchReadyAt: order.dispatch_ready_at,
        });
      }
      await this.scheduleReping(order.id, gateAt, now);
      return { kind: 'sent', agentIds: sent.map((a) => a.agentId) };
    } catch (error) {
      this.logger.warn(
        `Dedicated heads-up failed for ${orderId}: ${error instanceof Error ? error.message : String(error)}`
      );
      return { kind: 'skipped', reason: 'not_found' };
    }
  }

  /** Wait-and-execute callback, ~HEADS_UP_REPING_LEAD_MINUTES before the gate. */
  async repingForOrder(orderId: string, now: Date = new Date()): Promise<HeadsUpOutcome> {
    try {
      const ctx = await this.loadContext(orderId, now);
      if ('skip' in ctx) return { kind: 'skipped', reason: ctx.skip };
      const { order, rows, slot, gateAt } = ctx;
      const repingAt = gateAt.getTime() - HEADS_UP_REPING_LEAD_MINUTES * 60_000;
      if (now.getTime() < repingAt - EARLY_SLACK_SECONDS * 1000) return { kind: 'skipped', reason: 'stale' };
      const pending = new Set(rows.filter((r) => r.status === 'sent' && !r.reping_sent_at).map((r) => r.agent_id));
      if (pending.size === 0) return { kind: 'skipped', reason: 'no_agents' };
      const targets = (await this.eligibleAgents(order, slot)).filter((a) => pending.has(a.agentId));
      if (targets.length === 0) return { kind: 'skipped', reason: 'no_agents' };
      const res = await this.hasuraSystemService.executeMutation<{
        update_dedicated_order_heads_ups: { returning: Array<{ agent_id: string }> } | null;
      }>(CLAIM_REPING, {
        orderId: order.id,
        agentIds: targets.map((a) => a.agentId),
        now: now.toISOString(),
      });
      const claimed = new Set((res?.update_dedicated_order_heads_ups?.returning ?? []).map((r) => r.agent_id));
      const sent = targets.filter((a) => claimed.has(a.agentId));
      if (sent.length === 0) return { kind: 'skipped', reason: 'already_sent' };
      await this.push(order, slot, sent, true);
      for (const a of sent) {
        emitServerSiteEvent(this.siteEventsService, 'dedicated.heads_up_repinged', {
          orderId: order.id,
          agentId: a.agentId,
        });
      }
      return { kind: 'sent', agentIds: sent.map((a) => a.agentId) };
    } catch (error) {
      this.logger.warn(
        `Dedicated heads-up re-ping failed for ${orderId}: ${error instanceof Error ? error.message : String(error)}`
      );
      return { kind: 'skipped', reason: 'not_found' };
    }
  }

  /** The agent's own heads-up for an order (null when they never got one). */
  async getForAgent(userId: string, orderId: string): Promise<{ status: HeadsUpStatus; dispatchReadyAt: string | null; active: boolean } | null> {
    const row = await this.loadAgentRow(userId, orderId);
    if (!row) return null;
    const o = row.order;
    const active = !!o && o.current_status === 'ready_for_pickup' && !o.assigned_agent_id;
    return { status: row.status, dispatchReadyAt: o?.dispatch_ready_at ?? null, active };
  }

  /** "Can't take it": skip this agent for the order's dedicated dispatch. Idempotent. */
  async markUnavailable(userId: string, orderId: string, now: Date = new Date()): Promise<{ status: HeadsUpStatus }> {
    const row = await this.loadAgentRow(userId, orderId);
    if (!row) {
      throw new HttpException({ error: 'HEADS_UP_NOT_FOUND', message: 'No heads-up for this order' }, HttpStatus.NOT_FOUND);
    }
    if (row.status === 'unavailable') return { status: 'unavailable' };
    const o = row.order;
    if (!o || o.current_status !== 'ready_for_pickup' || o.assigned_agent_id) {
      throw new HttpException(
        { error: 'HEADS_UP_CLOSED', message: 'This order is no longer waiting for dispatch' },
        HttpStatus.CONFLICT
      );
    }
    await this.hasuraSystemService.executeMutation(MARK_UNAVAILABLE, {
      orderId,
      agentId: row.agent_id,
      now: now.toISOString(),
    });
    emitServerSiteEvent(this.siteEventsService, 'dedicated.heads_up_unavailable', {
      orderId,
      agentId: row.agent_id,
    });
    return { status: 'unavailable' };
  }

  private async loadAgentRow(
    userId: string,
    orderId: string
  ): Promise<{
    agent_id: string;
    status: HeadsUpStatus;
    order: { current_status: string; assigned_agent_id: string | null; dispatch_ready_at: string | null } | null;
  } | null> {
    const res = await this.hasuraSystemService.executeQuery<{
      dedicated_order_heads_ups: Array<{
        agent_id: string;
        status: HeadsUpStatus;
        order: { current_status: string; assigned_agent_id: string | null; dispatch_ready_at: string | null } | null;
      }>;
    }>(AGENT_HEADS_UP_QUERY, { orderId, userId });
    return res?.dedicated_order_heads_ups?.[0] ?? null;
  }

  private async loadContext(
    orderId: string,
    now: Date
  ): Promise<
    | { skip: 'not_found' | 'not_dispatchable' | 'not_covered' | 'flag_off' | 'gate_open' | 'no_slot' }
    | { order: HeadsUpOrder; rows: HeadsUpRow[]; slot: ResolvedDedicatedSlot; gateAt: Date }
  > {
    const res = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: HeadsUpOrder | null;
      dedicated_order_heads_ups: HeadsUpRow[];
    }>(HEADS_UP_ORDER_QUERY, { orderId });
    const order = res?.orders_by_pk;
    if (!order) return { skip: 'not_found' };
    if (
      order.current_status !== 'ready_for_pickup' ||
      order.assigned_agent_id ||
      order.fulfillment_method !== 'delivery'
    ) {
      return { skip: 'not_dispatchable' };
    }
    const window = order.delivery_time_windows?.[0];
    if (
      !order.coverage_slot_key ||
      !isDedicatedEligibleOrder({
        fulfillmentTiming: order.fulfillment_timing,
        hasDeliveryWindow: !!window?.slot_id && !!window?.preferred_date,
        windowConfirmed: window?.is_confirmed,
        requireConfirmedWindow: true,
      })
    ) {
      return { skip: 'not_covered' };
    }
    // Gate already open: dispatch (and its dedicated offers) reaches the agent now.
    const gateAt = order.dispatch_ready_at ? new Date(order.dispatch_ready_at) : null;
    if (!gateAt || gateAt.getTime() <= now.getTime()) return { skip: 'gate_open' };
    const country = isoCountryCode(order.business_location?.address?.country);
    if (!(await this.dedicatedConfig.isEnabled(country))) return { skip: 'flag_off' };
    const slot = await this.coverage.resolveSlot({
      locationId: order.business_location_id,
      preferredDate: window?.preferred_date as string,
      slotId: window?.slot_id as string,
    });
    if (!slot) return { skip: 'no_slot' };
    return { order, rows: res?.dedicated_order_heads_ups ?? [], slot, gateAt };
  }

  /** Same AC-E2 check as the dedicated fallback: paused, off today and at-capacity agents are left out. */
  private async eligibleAgents(order: HeadsUpOrder, slot: ResolvedDedicatedSlot): Promise<DedicatedEligibleAgent[]> {
    const rail = await this.paymentRoutingService.resolveRailForBusiness(order.business_id);
    const result = await this.coverage.evaluate({
      locationId: order.business_location_id,
      slotKey: slot.slotKey,
      fulfillmentTiming: order.fulfillment_timing,
      hasDeliveryWindow: true,
      windowConfirmed: true,
      requireConfirmedWindow: true,
      rail,
      subtotal: Number(order.subtotal) || 0,
      currency: order.currency,
      verifiedAgentDelivery: order.verified_agent_delivery === true,
      excludeOrderId: order.id,
      slotDate: slot.date,
    });
    return result.eligible.filter((a) => !!a.userId);
  }

  private async claim(orderId: string, agents: DedicatedEligibleAgent[]): Promise<Set<string>> {
    const objects = [...agents]
      .sort((a, b) => (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0))
      .map((a) => ({
        order_id: orderId,
        agent_id: a.agentId,
        user_id: a.userId,
        assignment_id: a.assignmentId,
        status: 'sent',
      }));
    const res = await this.hasuraSystemService.executeMutation<{
      insert_dedicated_order_heads_ups: { returning: Array<{ agent_id: string }> } | null;
    }>(CLAIM_HEADS_UPS, { objects });
    return new Set((res?.insert_dedicated_order_heads_ups?.returning ?? []).map((r) => r.agent_id));
  }

  private async push(
    order: HeadsUpOrder,
    slot: ResolvedDedicatedSlot,
    agents: DedicatedEligibleAgent[],
    reping: boolean
  ): Promise<void> {
    const locales = await this.loadLocales(agents.map((a) => a.userId as string));
    const storeName = order.business_location?.name || order.business?.name || '';
    await Promise.all(
      agents.map((a) => {
        const msg = buildDedicatedHeadsUpMessage({
          orderNumber: order.order_number,
          storeName,
          slotKey: slot.slotKey,
          reping,
          preferredLanguage: locales.get(a.userId as string) ?? null,
        });
        return this.notificationsService
          .sendDedicatedOrderNotice({
            userId: a.userId as string,
            title: msg.title,
            body: msg.body,
            messageType: DEDICATED_ORDER_HEADS_UP_MESSAGE_TYPE,
            orderId: order.id,
            event: reping ? 'dedicated.heads_up_reping' : 'dedicated.heads_up',
            persona: 'agent',
          })
          .catch(() => undefined);
      })
    );
  }

  private async scheduleReping(orderId: string, gateAt: Date, now: Date): Promise<void> {
    const waitSeconds = Math.floor(
      (gateAt.getTime() - HEADS_UP_REPING_LEAD_MINUTES * 60_000 - now.getTime()) / 1000
    );
    if (waitSeconds < MIN_REPING_GAP_SECONDS) return;
    try {
      await this.waitAndExecuteScheduleService.scheduleDedicatedHeadsUpReping(orderId, waitSeconds);
    } catch (error) {
      this.logger.warn(
        `Heads-up re-ping not scheduled for ${orderId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async loadLocales(userIds: string[]): Promise<Map<string, string | null>> {
    try {
      const res = await this.hasuraSystemService.executeQuery<{
        users: Array<{ id: string; preferred_language: string | null }>;
      }>(LOCALES_QUERY, { userIds });
      return new Map((res?.users ?? []).map((u) => [u.id, u.preferred_language]));
    } catch {
      return new Map();
    }
  }
}
