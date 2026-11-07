import { HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommissionsService } from '../commissions/commissions.service';
import { DedicatedAgentsConfigService } from '../dedicated-agents/dedicated-agents-config.service';
import type { DedicatedAgentsConfig } from '../dedicated-agents/dedicated-agents.constants';
import { orderAssignmentsForLocking } from '../dedicated-agents/dedicated-assignment-locking.util';
import { runAssignmentWrite } from '../dedicated-agents/dedicated-assignment-write.util';
import {
  DedicatedCoverageService,
  type DedicatedEligibleAgent,
  type ResolvedDedicatedSlot,
} from '../dedicated-agents/dedicated-coverage.service';
import { isDedicatedEligibleOrder } from '../dedicated-agents/dedicated-eligibility.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  buildDesignatedEarlyOfferMessage,
  buildDesignatedOpenOfferReminderMessage,
  buildDesignatedPickupReminderMessage,
  buildDesignatedUnconfirmedMessage,
  designatedWindowLabel,
  DESIGNATED_FIRST_MESSAGE_TYPES,
} from '../notifications/designated-first.messages';
import { NotificationsService } from '../notifications/notifications.service';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { DEDICATED_ORDER_CLAIMER, type DedicatedOrderClaimer } from './dedicated-claim.port';
import { isoCountryCode } from './delivery-pricing.util';
import {
  designatedArea,
  designatedDueActions,
  designatedReleaseCutoffAt,
  DESIGNATED_STUCK_OFFER_MS,
  haversineKm,
  pickDistanceOrigin,
  toPoint,
  type DesignatedAction,
} from './designated-first.util';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

export interface DesignatedOrder {
  id: string;
  order_number: string;
  business_id: string;
  business_location_id: string;
  current_status: string;
  assigned_agent_id: string | null;
  assignment_source: string | null;
  fulfillment_method: string | null;
  fulfillment_timing: string | null;
  subtotal: number | string | null;
  currency: string;
  verified_agent_delivery: boolean | null;
  coverage_slot_key: string | null;
  dispatch_ready_at: string | null;
  dispatch_round: number | null;
  pickup_by: string | null;
  dispatch_mode: string | null;
  designated_accepted_at: string | null;
  designated_release_cutoff_at: string | null;
  designated_reminder_sent_at: string | null;
  designated_evening_reminder_sent_at: string | null;
  designated_confirmed_at: string | null;
  designated_unconfirmed_flagged_at: string | null;
  business?: { name?: string | null; user_id?: string | null; user?: { preferred_language?: string | null } | null } | null;
  business_location?: {
    name?: string | null;
    address?: { country?: string | null; city?: string | null; latitude?: unknown; longitude?: unknown } | null;
  } | null;
  delivery_address?: { city?: string | null; state?: string | null; latitude?: unknown; longitude?: unknown } | null;
  delivery_time_windows?: Array<{
    slot_id: string | null;
    preferred_date: string | null;
    is_confirmed: boolean | null;
    time_slot_start?: string | null;
    time_slot_end?: string | null;
  }>;
  assigned_agent?: { id: string; user_id: string | null; user?: { preferred_language?: string | null } | null } | null;
}

interface DesignatedOfferRow {
  id: string;
  agent_id: string;
  user_id: string | null;
  status: string;
  phase: string | null;
  expires_at: string;
  reminder_sent_at: string | null;
  dedicated_attempt?: number | null;
}

interface CoverageOrderRow {
  id: string;
  order_number: string;
  business_location_id: string;
  coverage_slot_key: string | null;
  currency: string;
  dispatch_ready_at: string | null;
  pickup_by: string | null;
  fulfillment_timing: string | null;
  business_location?: {
    name?: string | null;
    address?: { city?: string | null; country?: string | null } | null;
  } | null;
  delivery_address?: { city?: string | null; state?: string | null } | null;
  delivery_time_windows?: Array<{
    slot_id: string | null;
    preferred_date: string | null;
    is_confirmed: boolean | null;
    time_slot_start?: string | null;
    time_slot_end?: string | null;
  }>;
}

const ORDER_FIELDS = `
  id order_number business_id business_location_id current_status assigned_agent_id assignment_source
  fulfillment_method fulfillment_timing subtotal currency verified_agent_delivery coverage_slot_key
  dispatch_ready_at dispatch_round pickup_by dispatch_mode designated_accepted_at designated_release_cutoff_at
  designated_reminder_sent_at designated_evening_reminder_sent_at designated_confirmed_at designated_unconfirmed_flagged_at
  business { name user_id user { preferred_language } }
  business_location { name address { country city latitude longitude } }
  delivery_address { city state latitude longitude }
  delivery_time_windows(order_by: { created_at: desc }, limit: 1) {
    slot_id preferred_date is_confirmed time_slot_start time_slot_end
  }
  assigned_agent { id user_id user { preferred_language } }
`;

const DESIGNATED_ORDER_QUERY = `
  query DesignatedOrder($orderId: uuid!) {
    orders_by_pk(id: $orderId) { ${ORDER_FIELDS} }
    order_offers(where: { order_id: { _eq: $orderId }, offer_kind: { _eq: "dedicated" } }) {
      id agent_id user_id status phase expires_at reminder_sent_at dedicated_attempt
    }
  }
`;

const AGENT_ORIGINS_QUERY = `
  query DesignatedAgentOrigins($ids: [uuid!]!) {
    agents(where: { id: { _in: $ids } }) {
      id
      user { id preferred_language }
      agent_locations(order_by: { updated_at: desc }, limit: 1) { latitude longitude updated_at }
      agent_addresses(where: { address: { status: { _eq: active } } }) {
        address { latitude longitude is_primary }
      }
    }
  }
`;

const UPSERT_EARLY_OFFERS = `
  mutation UpsertDesignatedEarlyOffers($objects: [order_offers_insert_input!]!) {
    insert_order_offers(
      objects: $objects
      on_conflict: {
        constraint: order_offers_order_agent_unique
        where: { status: { _eq: expired } }
        update_columns: [status offer_kind phase payload decline_reason distance_km estimated_earnings currency expires_at created_at responded_at reminder_sent_at dedicated_attempt]
      }
    ) { returning { agent_id } }
  }
`;

const STAMP_MODE = `
  mutation StampDesignatedMode($id: uuid!, $mode: String!) {
    update_orders(where: { id: { _eq: $id }, dispatch_mode: { _is_null: true } }, _set: { dispatch_mode: $mode }) {
      affected_rows
    }
  }
`;

/** Open early offers stay live through round 1: the designated agent is in the first nearby round. */
const MOVE_EARLY_TO_GATE = `
  mutation MoveEarlyOffersToGate($orderId: uuid!, $expiresAt: timestamptz!) {
    update_order_offers(
      where: { order_id: { _eq: $orderId }, offer_kind: { _eq: "dedicated" }, phase: { _eq: "early" }, status: { _eq: "offered" } }
      _set: { phase: "gate", expires_at: $expiresAt }
    ) { returning { agent_id } }
  }
`;

/** A late accept: the agent's expired (never declined) row is reopened while the order is still unassigned. */
const REOPEN_LATE_OFFER = `
  mutation ReopenLateDesignatedOffer($orderId: uuid!, $agentId: uuid!, $expiresAt: timestamptz!) {
    update_order_offers(
      where: {
        order_id: { _eq: $orderId }
        agent_id: { _eq: $agentId }
        offer_kind: { _eq: "dedicated" }
        status: { _eq: "expired" }
        order: { assigned_agent_id: { _is_null: true }, current_status: { _eq: ready_for_pickup }, dispatch_mode: { _eq: "designated_first" } }
      }
      _set: { status: "offered", expires_at: $expiresAt, responded_at: null }
    ) { affected_rows }
  }
`;

const STAMP_ACCEPTED = `
  mutation StampDesignatedAccepted($id: uuid!, $agentId: uuid!, $at: timestamptz!, $cutoff: timestamptz) {
    update_orders(
      where: { id: { _eq: $id }, assigned_agent_id: { _eq: $agentId }, dispatch_mode: { _eq: "designated_first" } }
      _set: {
        designated_accepted_at: $at
        designated_release_cutoff_at: $cutoff
        dedicated_release_until: $cutoff
        designated_confirmed_at: null
        designated_reminder_sent_at: null
        designated_evening_reminder_sent_at: null
        designated_unconfirmed_flagged_at: null
      }
    ) { affected_rows }
  }
`;

const CLAIM_ORDER_STAMP = (column: string) => `
  mutation ClaimDesignatedStamp($id: uuid!, $at: timestamptz!) {
    update_orders(where: { id: { _eq: $id }, ${column}: { _is_null: true } }, _set: { ${column}: $at }) {
      affected_rows
    }
  }
`;

const CLAIM_OFFER_REMINDERS = `
  mutation ClaimOpenOfferReminders($orderId: uuid!, $at: timestamptz!) {
    update_order_offers(
      where: {
        order_id: { _eq: $orderId }
        offer_kind: { _eq: "dedicated" }
        phase: { _eq: "early" }
        status: { _eq: "offered" }
        reminder_sent_at: { _is_null: true }
      }
      _set: { reminder_sent_at: $at }
    ) { returning { agent_id user_id } }
  }
`;

/** Ignore on home/hub: hide without declining so a push accept still works. */
const DISMISS_DASHBOARD_OFFER = `
  mutation DismissDesignatedDashboardOffer(
    $orderId: uuid!, $agentId: uuid!, $now: timestamptz!, $at: timestamptz!
  ) {
    update_order_offers(
      where: {
        order_id: { _eq: $orderId }
        agent_id: { _eq: $agentId }
        offer_kind: { _eq: "dedicated" }
        status: { _eq: "offered" }
        expires_at: { _gt: $now }
        dashboard_dismissed_at: { _is_null: true }
      }
      _set: { dashboard_dismissed_at: $at }
    ) { affected_rows }
  }
`;

const RELIABILITY_EVENT = `
  mutation InsertAgentReliabilityEvent($object: agent_reliability_events_insert_input!) {
    insert_agent_reliability_events_one(
      object: $object
      on_conflict: { constraint: agent_reliability_events_once_idx, update_columns: [] }
    ) { id }
  }
`;

const SWEEP_QUERY = `
  query DesignatedSweep($since: timestamptz!) {
    orders(
      where: {
        dispatch_mode: { _eq: "designated_first" }
        current_status: { _in: [ready_for_pickup, assigned_to_agent] }
        pickup_by: { _gte: $since }
      }
      limit: 200
    ) { id }
  }
`;

const AGENT_OFFERS_QUERY = `
  query DesignatedAgentOffers($agentId: uuid!, $now: timestamptz!) {
    order_offers(
      where: {
        agent_id: { _eq: $agentId }
        offer_kind: { _eq: "dedicated" }
        status: { _eq: "offered" }
        expires_at: { _gt: $now }
      }
      order_by: { expires_at: asc }
    ) {
      order_id phase expires_at payload estimated_earnings currency created_at dashboard_dismissed_at
    }
    orders(
      where: {
        assigned_agent_id: { _eq: $agentId }
        dispatch_mode: { _eq: "designated_first" }
        current_status: { _eq: assigned_to_agent }
      }
      order_by: { pickup_by: asc }
    ) {
      id order_number pickup_by dispatch_ready_at designated_release_cutoff_at designated_confirmed_at
      business_location { name }
      delivery_time_windows(order_by: { created_at: desc }, limit: 1) { preferred_date time_slot_start time_slot_end }
    }
  }
`;

/** Active store/slot coverage for this agent (planning list, not offer-gated). */
const AGENT_COVERAGE_ASSIGNMENTS_QUERY = `
  query AgentCoverageAssignments($agentId: uuid!) {
    dedicated_agent_assignments(
      where: { agent_id: { _eq: $agentId }, status: { _eq: "active" } }
    ) {
      business_location_id
      slot_key
      off_today_date
    }
  }
`;

/** Pre-gate ready delivery orders on locations the agent covers (filtered to slot pairs in code). */
const AGENT_COVERAGE_ORDERS_QUERY = `
  query AgentCoverageOrders($locationIds: [uuid!]!, $slotKeys: [String!]!, $now: timestamptz!) {
    orders(
      where: {
        current_status: { _eq: "ready_for_pickup" }
        assigned_agent_id: { _is_null: true }
        fulfillment_method: { _eq: "delivery" }
        dispatch_ready_at: { _gt: $now }
        business_location_id: { _in: $locationIds }
        coverage_slot_key: { _in: $slotKeys }
      }
      order_by: { dispatch_ready_at: asc }
      limit: 50
    ) {
      id order_number business_location_id coverage_slot_key currency
      dispatch_ready_at pickup_by fulfillment_timing
      business_location { name address { city country } }
      delivery_address { city state }
      delivery_time_windows(order_by: { created_at: desc }, limit: 1) {
        slot_id preferred_date is_confirmed time_slot_start time_slot_end
      }
    }
  }
`;

/** Orders this agent already declined as dedicated — keep them off coverage Take cards. */
const AGENT_DECLINED_DEDICATED_QUERY = `
  query AgentDeclinedDedicated($agentId: uuid!) {
    order_offers(
      where: {
        agent_id: { _eq: $agentId }
        offer_kind: { _eq: "dedicated" }
        status: { _eq: "declined" }
      }
    ) {
      order_id
    }
  }
`;

/**
 * Quiet ensure for Take/Ignore: reopen a prior dedicated row without a push.
 * Includes cancelled/accepted leftovers (failed-claim rows) so Hasura's
 * insert-on-conflict (expired-only) cannot no-op and leave Take with no offer.
 * Declined stays excluded — Drop / Can't make it / pickup SLA must not reclaim.
 * Join-guard: never reopen while another agent already holds the order.
 */
const REFRESH_EARLY_OFFER = `
  mutation RefreshDesignatedEarlyOffer(
    $orderId: uuid!, $agentId: uuid!, $expiresAt: timestamptz!, $payload: jsonb
    $earnings: numeric, $currency: String
  ) {
    update_order_offers(
      where: {
        order_id: { _eq: $orderId }
        agent_id: { _eq: $agentId }
        offer_kind: { _eq: "dedicated" }
        status: { _in: ["offered", "expired", "cancelled", "accepted"] }
        order: { assigned_agent_id: { _is_null: true }, current_status: { _eq: ready_for_pickup } }
      }
      _set: {
        status: "offered"
        phase: "early"
        expires_at: $expiresAt
        payload: $payload
        estimated_earnings: $earnings
        currency: $currency
        responded_at: null
        dashboard_dismissed_at: null
      }
    ) { affected_rows }
  }
`;

export type OfferAtReadyOutcome =
  | { kind: 'skipped'; reason: string }
  | { kind: 'offered'; agentIds: string[] }
  | { kind: 'auto_assigned'; agentId: string }
  | { kind: 'fallback' };

export interface DesignatedOfferPayload {
  date: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  gateAt: string | null;
  businessName: string;
  pickupArea: string;
  dropoffArea: string;
  pickupKm: number | null;
  dropoffKm: number | null;
  distanceOrigin: 'gps' | 'home' | null;
  commission: number | null;
  currency: string | null;
  releaseCutoffAt: string | null;
}

/**
 * Designated agent first (plan designated-agent-first-plan.md). Behind
 * `designated_first_enabled` (and `dedicated_agents_enabled`): a covered,
 * confirmed scheduled order is OFFERED to its designated agent(s) as soon as it
 * is ready (offer valid until the dispatch gate), instead of the soft heads-up.
 * An accept assigns right away (free release until the cutoff, then reminders);
 * no answer by the gate keeps the designated agent in round 1 with nearby agents.
 * Never throws on the dispatch paths: a failure falls back to today's flow.
 */
@Injectable()
export class DesignatedFirstService {
  private readonly logger = new Logger(DesignatedFirstService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly dedicatedConfig: DedicatedAgentsConfigService,
    private readonly coverage: DedicatedCoverageService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly notifications: NotificationsService,
    private readonly commissionsService: CommissionsService,
    private readonly waitAndExecute: WaitAndExecuteScheduleService,
    private readonly moduleRef: ModuleRef,
    @Optional()
    private readonly siteEventsService?: SiteEventsService
  ) {}

  /** Whether the designated-first flow applies to orders of this country right now. */
  async isActive(country: string | null): Promise<boolean> {
    const config = await this.dedicatedConfig.getConfig(country);
    return config.enabled && config.designatedFirstEnabled;
  }

  async load(orderId: string): Promise<{ order: DesignatedOrder | null; offers: DesignatedOfferRow[] }> {
    const res = await this.hasura.executeQuery<{
      orders_by_pk: DesignatedOrder | null;
      order_offers: DesignatedOfferRow[];
    }>(DESIGNATED_ORDER_QUERY, { orderId });
    return { order: res?.orders_by_pk ?? null, offers: res?.order_offers ?? [] };
  }

  /**
   * At ready_for_pickup (and when a release before the cutoff hands the order back):
   * offer the order to the slot's designated agents now, valid until the gate.
   * Returns `skipped` when the order is not in scope (legacy heads-up then applies).
   */
  async offerAtReady(orderId: string, now: Date = new Date()): Promise<OfferAtReadyOutcome> {
    try {
      const { order, offers } = await this.load(orderId);
      if (!order) return { kind: 'skipped', reason: 'not_found' };
      if (order.current_status !== 'ready_for_pickup' || order.assigned_agent_id || order.fulfillment_method !== 'delivery') {
        return { kind: 'skipped', reason: 'not_dispatchable' };
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
        return { kind: 'skipped', reason: 'not_covered' };
      }
      const country = isoCountryCode(order.business_location?.address?.country);
      const config = await this.dedicatedConfig.getConfig(country);
      if (!config.enabled || !config.designatedFirstEnabled) return { kind: 'skipped', reason: 'flag_off' };
      const gateAt = order.dispatch_ready_at ? new Date(order.dispatch_ready_at) : null;
      if (!gateAt || gateAt.getTime() <= now.getTime()) return { kind: 'skipped', reason: 'gate_open' };
      const slot = await this.coverage.resolveSlot({
        locationId: order.business_location_id,
        preferredDate: window?.preferred_date as string,
        slotId: window?.slot_id as string,
      });
      if (!slot) return { kind: 'skipped', reason: 'no_slot' };

      // An agent who declined (or released) is never re-offered; live rows are left alone.
      const excluded = new Set(
        offers.filter((o) => o.status === 'declined' || o.status === 'offered' || o.status === 'accepted').map((o) => o.agent_id)
      );
      const reachable = (await this.eligibleAgents(order, slot)).filter((a) => !!a.userId && !excluded.has(a.agentId));
      if (reachable.length === 0) {
        if (!offers.some((o) => o.status === 'offered')) await this.stampMode(order.id, 'fallback');
        return { kind: 'fallback' };
      }
      await this.stampMode(order.id, 'designated_first');
      if (offers.length === 0 && reachable.length === 1 && reachable[0].isInternal && config.autoAssignInternal) {
        const ok = await this.autoAssignInternal(order, slot, reachable[0], config);
        if (ok) return { kind: 'auto_assigned', agentId: reachable[0].agentId };
      }
      const sent = await this.sendEarlyOffers(order, slot, reachable, gateAt, config, now, offers);
      await this.scheduleTick(order.id, now, config);
      return { kind: 'offered', agentIds: sent };
    } catch (error) {
      this.logger.warn(`Designated early offer failed for ${orderId}: ${this.msg(error)}`);
      return { kind: 'skipped', reason: 'error' };
    }
  }

  /**
   * Round 1 at the gate (OrderOffersService.runDispatchRound). Open early offers move to
   * phase `gate` with the round TTL, so the designated agent stays in round 1; returns
   * their agent ids so the nearby insert leaves those rows alone.
   */
  async atGate(orderId: string, ttlSeconds: number, now: Date = new Date()): Promise<Set<string>> {
    try {
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
      const res = await this.hasura.executeMutation<{
        update_order_offers: { returning: Array<{ agent_id: string }> } | null;
      }>(MOVE_EARLY_TO_GATE, { orderId, expiresAt });
      const kept = new Set((res?.update_order_offers?.returning ?? []).map((r) => r.agent_id));
      for (const agentId of kept) {
        emitServerSiteEvent(this.siteEventsService, 'dedicated.expired_at_gate', { orderId, agentId, keptInRound1: true });
      }
      return kept;
    } catch (error) {
      this.logger.warn(`Designated gate step failed for ${orderId}: ${this.msg(error)}`);
      return new Set();
    }
  }

  /**
   * The gate opened on an order the designated agent already holds: if they never
   * confirmed ("Still on it"), flag it to admin + business (no strike, no auto release
   * unless `designated_unconfirmed_auto_release`). Idempotent on designated_unconfirmed_flagged_at.
   */
  async checkUnconfirmedAtGate(orderId: string, now: Date = new Date()): Promise<'flagged' | 'released' | 'ok'> {
    try {
      const { order } = await this.load(orderId);
      if (
        !order ||
        order.dispatch_mode !== 'designated_first' ||
        order.current_status !== 'assigned_to_agent' ||
        !order.designated_accepted_at ||
        order.designated_confirmed_at
      ) {
        return 'ok';
      }
      if (!(await this.claimStamp(order.id, 'designated_unconfirmed_flagged_at', now))) return 'ok';
      const agentId = order.assigned_agent_id as string;
      await this.recordReliability(agentId, order.id, 'reminder_unconfirmed', { gateAt: order.dispatch_ready_at });
      emitServerSiteEvent(this.siteEventsService, 'dedicated.unconfirmed_at_gate', {
        orderId: order.id,
        agentId,
        businessId: order.business_id,
      });
      this.logger.warn(
        JSON.stringify({ event: 'dedicated.unconfirmed_at_gate', orderId: order.id, orderNumber: order.order_number, agentId })
      );
      const businessUserId = order.business?.user_id;
      if (businessUserId) {
        const msg = buildDesignatedUnconfirmedMessage({
          orderNumber: order.order_number,
          preferredLanguage: order.business?.user?.preferred_language,
        });
        await this.notifications
          .sendDedicatedOrderNotice({
            userId: businessUserId,
            title: msg.title,
            body: msg.body,
            messageType: DESIGNATED_FIRST_MESSAGE_TYPES.unconfirmed,
            orderId: order.id,
            event: 'dedicated.unconfirmed_at_gate',
            persona: 'business',
          })
          .catch(() => undefined);
      }
      const country = isoCountryCode(order.business_location?.address?.country);
      const config = await this.dedicatedConfig.getConfig(country);
      if (config.designatedUnconfirmedAutoRelease) {
        const reassign = this.reassigner();
        if (reassign) {
          await reassign.reassignOrder(order.id, 'designated_unconfirmed_at_gate', { skipReliabilityPenalty: true });
          return 'released';
        }
      }
      return 'flagged';
    } catch (error) {
      this.logger.warn(`Unconfirmed check failed for ${orderId}: ${this.msg(error)}`);
      return 'ok';
    }
  }

  /**
   * After an early-phase decline with no other live offer: before the gate nothing
   * happens (the gate callback runs round 1); at or after it, round 1 now.
   * Returns 'wait' | 'round1' | 'legacy'.
   */
  decideAfterDecline(order: { dispatch_mode?: string | null; dispatch_round?: number | null; dispatch_ready_at?: string | null }, now: Date = new Date()): 'wait' | 'round1' | 'legacy' {
    if (order.dispatch_mode !== 'designated_first' || (order.dispatch_round ?? 0) > 0) return 'legacy';
    const gate = order.dispatch_ready_at ? new Date(order.dispatch_ready_at).getTime() : 0;
    return gate > now.getTime() ? 'wait' : 'round1';
  }

  onEarlyDecline(orderId: string, agentId: string, reason: string | null): void {
    emitServerSiteEvent(this.siteEventsService, 'dedicated.early_offer_declined', { orderId, agentId, reason });
  }

  /**
   * Late accept wins when the order is still unassigned: the agent's expired row is
   * reopened for a minute so the usual accept/claim path runs. False when not allowed
   * (declined, order taken, or not a designated-first order).
   */
  async reopenLateOffer(orderId: string, agentId: string, now: Date = new Date()): Promise<boolean> {
    try {
      const res = await this.hasura.executeMutation<{ update_order_offers: { affected_rows: number } | null }>(
        REOPEN_LATE_OFFER,
        { orderId, agentId, expiresAt: new Date(now.getTime() + 60_000).toISOString() }
      );
      const ok = (res?.update_order_offers?.affected_rows ?? 0) > 0;
      if (ok) emitServerSiteEvent(this.siteEventsService, 'dedicated.late_accept', { orderId, agentId });
      return ok;
    } catch (error) {
      this.logger.warn(`Late accept reopen failed for ${orderId}: ${this.msg(error)}`);
      return false;
    }
  }

  /**
   * After any assignment (OrdersService.onOrderAssignedToAgent): a designated-first
   * order assigned before its gate gets the accept stamps (free release until the
   * cutoff) and its reminder ticks.
   */
  async onAssigned(orderId: string, now: Date = new Date()): Promise<void> {
    try {
      const { order } = await this.load(orderId);
      if (!order || order.dispatch_mode !== 'designated_first' || !order.assigned_agent_id) return;
      if (!['dedicated_offer', 'dedicated_auto'].includes(order.assignment_source ?? '')) return;
      const gate = order.dispatch_ready_at ? new Date(order.dispatch_ready_at).getTime() : 0;
      if (gate <= now.getTime()) return; // assigned at/after the gate: today's flow
      const country = isoCountryCode(order.business_location?.address?.country);
      const config = await this.dedicatedConfig.getConfig(country);
      const windowStart = order.pickup_by ? new Date(order.pickup_by) : null;
      const cutoff = windowStart ? designatedReleaseCutoffAt(windowStart, config.designatedReleaseCutoffMinutes) : null;
      await this.hasura.executeMutation(STAMP_ACCEPTED, {
        id: order.id,
        agentId: order.assigned_agent_id,
        at: now.toISOString(),
        cutoff: cutoff && cutoff.getTime() > now.getTime() ? cutoff.toISOString() : null,
      });
      emitServerSiteEvent(this.siteEventsService, 'dedicated.early_offer_accepted', {
        orderId: order.id,
        agentId: order.assigned_agent_id,
        source: order.assignment_source,
        releaseCutoffAt: cutoff?.toISOString() ?? null,
        msBeforeGate: gate - now.getTime(),
      });
      await this.scheduleTick(order.id, now, config);
    } catch (error) {
      this.logger.warn(`Designated accept stamp failed for ${orderId}: ${this.msg(error)}`);
    }
  }

  /**
   * Home Ignore: stamp dashboard_dismissed_at on the caller's open dedicated offer.
   * Ensures a coverage early offer exists first so Ignore works without a prior push.
   * Does not decline; hub still lists the card; push accept still works until the gate.
   */
  async dismissDashboardOffer(
    orderId: string,
    agentId: string,
    now: Date = new Date()
  ): Promise<{ dismissedAt: string }> {
    await this.ensureEarlyOfferForAgent(orderId, agentId, now);
    const at = now.toISOString();
    const res = await this.hasura.executeMutation<{
      update_order_offers: { affected_rows: number } | null;
    }>(DISMISS_DASHBOARD_OFFER, { orderId, agentId, now: at, at });
    if ((res?.update_order_offers?.affected_rows ?? 0) < 1) {
      throw new HttpException(
        { error: 'NOT_OFFERED', message: 'No open designated offer to hide' },
        HttpStatus.CONFLICT
      );
    }
    emitServerSiteEvent(this.siteEventsService, 'dedicated.dashboard_offer_dismissed', {
      orderId,
      agentId,
    });
    return { dismissedAt: at };
  }

  /**
   * Ensure this coverage agent has an open early dedicated offer (no push).
   * Used by Take when the offer row is missing and by Ignore for coverage cards.
   */
  async ensureEarlyOfferForAgent(orderId: string, agentId: string, now: Date = new Date()): Promise<boolean> {
    try {
      const { order, offers } = await this.load(orderId);
      if (this.hasLiveDedicatedOffer(offers, agentId, now)) return true;
      const ctx = await this.coverageEnsureContext(order, offers, agentId, now);
      if (!ctx || !order) return false;
      await this.stampMode(order.id, 'designated_first');
      return this.writeQuietEarlyOffer(order, ctx.agent, ctx.slot, ctx.gateAt, ctx.config, now, offers);
    } catch (error) {
      this.logger.warn(`Ensure early offer failed for ${orderId}: ${this.msg(error)}`);
      return false;
    }
  }

  private hasLiveDedicatedOffer(offers: DesignatedOfferRow[], agentId: string, now: Date): boolean {
    return offers.some(
      (o) => o.agent_id === agentId && o.status === 'offered' && new Date(o.expires_at).getTime() > now.getTime()
    );
  }

  /** "Still on it": the agent confirms the order they hold. */
  async confirm(orderId: string, agentId: string, now: Date = new Date()): Promise<{ confirmedAt: string }> {
    const { order } = await this.load(orderId);
    if (!order || order.assigned_agent_id !== agentId || order.current_status !== 'assigned_to_agent') {
      throw new HttpException({ error: 'NOT_ASSIGNED', message: 'This order is not assigned to you' }, HttpStatus.CONFLICT);
    }
    if (order.dispatch_mode !== 'designated_first') {
      throw new HttpException({ error: 'NOT_DESIGNATED', message: 'Nothing to confirm on this order' }, HttpStatus.CONFLICT);
    }
    if (order.designated_confirmed_at) return { confirmedAt: order.designated_confirmed_at };
    await this.claimStamp(order.id, 'designated_confirmed_at', now);
    emitServerSiteEvent(this.siteEventsService, 'dedicated.designated_confirmed', { orderId, agentId });
    return { confirmedAt: now.toISOString() };
  }

  /** Wait-and-execute tick (reuses order.dedicated_heads_up_reping): due reminders, then the next tick. */
  async tick(orderId: string, now: Date = new Date()): Promise<{ sent: DesignatedAction[]; nextAt: string | null }> {
    const { order, offers } = await this.load(orderId);
    if (!order || order.dispatch_mode !== 'designated_first') return { sent: [], nextAt: null };
    const country = isoCountryCode(order.business_location?.address?.country);
    const config = await this.dedicatedConfig.getConfig(country);
    const { due, nextAt } = this.dueFor(order, offers, now, config, await this.timeZoneFor(order));
    const sent: DesignatedAction[] = [];
    for (const action of due) {
      if (await this.sendAction(order, action, now)) sent.push(action);
    }
    if (nextAt) await this.waitAndExecute.scheduleDedicatedHeadsUpReping(order.id, Math.ceil((nextAt.getTime() - now.getTime()) / 1000));
    return { sent, nextAt: nextAt?.toISOString() ?? null };
  }

  /**
   * Safety net every 5 minutes: lost SFN callbacks. Runs due reminders, the gate
   * (round 1 / unconfirmed flag) once the gate has passed, and raises the stuck-offer
   * alarm for an early offer still open 5+ minutes past its expiry.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep(now: Date = new Date()): Promise<void> {
    try {
      const res = await this.hasura.executeQuery<{ orders: Array<{ id: string }> }>(SWEEP_QUERY, {
        since: new Date(now.getTime() - 6 * 3600_000).toISOString(),
      });
      for (const { id } of res?.orders ?? []) await this.sweepOne(id, now);
    } catch (error) {
      this.logger.warn(`Designated sweep failed: ${this.msg(error)}`);
    }
  }

  private async sweepOne(orderId: string, now: Date): Promise<void> {
    try {
      const { order, offers } = await this.load(orderId);
      if (!order) return;
      await this.tick(orderId, now);
      const gate = order.dispatch_ready_at ? new Date(order.dispatch_ready_at).getTime() : null;
      if (gate == null || gate > now.getTime()) return;
      for (const o of offers) {
        if (o.status === 'offered' && new Date(o.expires_at).getTime() + DESIGNATED_STUCK_OFFER_MS < now.getTime()) {
          this.logger.error(JSON.stringify({ event: 'dedicated.early_offer_stuck', orderId, agentId: o.agent_id, expiresAt: o.expires_at }));
          emitServerSiteEvent(this.siteEventsService, 'dedicated.early_offer_stuck', { orderId, agentId: o.agent_id });
        }
      }
      if (order.current_status === 'assigned_to_agent') {
        await this.checkUnconfirmedAtGate(orderId, now);
      } else if (!order.assigned_agent_id && (order.dispatch_round ?? 0) === 0) {
        await this.offersService()?.runDispatchRound(orderId, 1);
      }
    } catch (error) {
      this.logger.warn(`Designated sweep of ${orderId} failed: ${this.msg(error)}`);
    }
  }

  /**
   * Agent list: open dedicated offers (incl. Home-dismissed) merged with pre-gate
   * ready orders on the agent's active store/slot coverage, plus assigned upcoming.
   */
  async listForAgent(agentId: string, now: Date = new Date()) {
    const res = await this.hasura.executeQuery<{
      order_offers: Array<{
        order_id: string;
        phase: string | null;
        expires_at: string;
        payload: DesignatedOfferPayload | null;
        estimated_earnings: number | null;
        currency: string | null;
        created_at: string;
        dashboard_dismissed_at: string | null;
      }>;
      orders: Array<{
        id: string;
        order_number: string;
        pickup_by: string | null;
        dispatch_ready_at: string | null;
        designated_release_cutoff_at: string | null;
        designated_confirmed_at: string | null;
        business_location?: { name?: string | null } | null;
        delivery_time_windows?: Array<{ preferred_date: string | null; time_slot_start: string | null; time_slot_end: string | null }>;
      }>;
    }>(AGENT_OFFERS_QUERY, { agentId, now: now.toISOString() });
    const offers = this.mapOfferRows(res?.order_offers ?? []);
    const coverage = await this.coverageOffersForAgent(agentId, now, new Set(offers.map((o) => o.orderId)));
    return {
      offers: [...offers, ...coverage],
      upcoming: this.mapUpcomingRows(res?.orders ?? [], now),
    };
  }

  /** Reliability row (late release, unconfirmed at gate); one per (agent, order, kind). */
  async recordReliability(agentId: string, orderId: string, kind: 'late_release' | 'reminder_unconfirmed' | 'no_show', meta: Record<string, unknown>): Promise<void> {
    // Must not block release/reassignment, but a failed insert is a real bug (missing
    // Hasura unique constraint, permissions, etc.) — log at error so it pages.
    await this.hasura
      .executeMutation(RELIABILITY_EVENT, { object: { agent_id: agentId, order_id: orderId, kind, meta } })
      .catch((error) => this.logger.error(`Reliability event ${kind} for ${orderId}: ${this.msg(error)}`));
  }

  // ---- internals ----

  private mapOfferRows(
    rows: Array<{
      order_id: string;
      phase: string | null;
      expires_at: string;
      payload: DesignatedOfferPayload | null;
      estimated_earnings: number | null;
      currency: string | null;
      created_at: string;
      dashboard_dismissed_at: string | null;
    }>
  ) {
    return rows.map((o) => ({
      orderId: o.order_id,
      phase: o.phase ?? 'gate',
      expiresAt: o.expires_at,
      offeredAt: o.created_at,
      estimatedEarnings: o.estimated_earnings,
      currency: o.currency,
      details: o.payload ?? null,
      dismissedFromHome: !!o.dashboard_dismissed_at,
    }));
  }

  private mapUpcomingRows(
    rows: Array<{
      id: string;
      order_number: string;
      pickup_by: string | null;
      dispatch_ready_at: string | null;
      designated_release_cutoff_at: string | null;
      designated_confirmed_at: string | null;
      business_location?: { name?: string | null } | null;
      delivery_time_windows?: Array<{ preferred_date: string | null; time_slot_start: string | null; time_slot_end: string | null }>;
    }>,
    now: Date
  ) {
    return rows.map((o) => {
      const w = o.delivery_time_windows?.[0];
      return {
        orderId: o.id,
        orderNumber: o.order_number,
        storeName: o.business_location?.name ?? null,
        date: w?.preferred_date ?? null,
        windowStart: w?.time_slot_start ?? null,
        windowEnd: w?.time_slot_end ?? null,
        pickupBy: o.pickup_by,
        gateAt: o.dispatch_ready_at,
        releaseCutoffAt: o.designated_release_cutoff_at,
        freeRelease: !!o.designated_release_cutoff_at && new Date(o.designated_release_cutoff_at).getTime() > now.getTime(),
        confirmedAt: o.designated_confirmed_at,
      };
    });
  }

  private async coverageOffersForAgent(agentId: string, now: Date, knownOrderIds: Set<string>) {
    const pairs = await this.activeCoveragePairs(agentId, now);
    if (pairs.length === 0) return [];
    const locationIds = [...new Set(pairs.map((p) => p.locationId))];
    const slotKeys = [...new Set(pairs.map((p) => p.slotKey))];
    const pairSet = new Set(pairs.map((p) => `${p.locationId}:${p.slotKey}`));
    // Declined early offers must not reappear as coverage Take cards (ensure also refuses them).
    const blocked = new Set([...knownOrderIds, ...(await this.declinedDedicatedOrderIds(agentId))]);
    const res = await this.hasura
      .executeQuery<{ orders: CoverageOrderRow[] }>(AGENT_COVERAGE_ORDERS_QUERY, {
        locationIds,
        slotKeys,
        now: now.toISOString(),
      })
      .catch(() => null);
    return (res?.orders ?? [])
      .filter((o) => this.coverageOrderMatches(o, pairSet, blocked))
      .map((o) => this.synthesizeCoverageOffer(o, now));
  }

  private async declinedDedicatedOrderIds(agentId: string): Promise<string[]> {
    const res = await this.hasura
      .executeQuery<{ order_offers: Array<{ order_id: string }> }>(AGENT_DECLINED_DEDICATED_QUERY, {
        agentId,
      })
      .catch(() => null);
    return (res?.order_offers ?? []).map((o) => o.order_id);
  }

  private async activeCoveragePairs(agentId: string, now: Date): Promise<Array<{ locationId: string; slotKey: string }>> {
    const today = now.toISOString().slice(0, 10);
    const res = await this.hasura
      .executeQuery<{
        dedicated_agent_assignments: Array<{
          business_location_id: string;
          slot_key: string;
          off_today_date: string | null;
        }>;
      }>(AGENT_COVERAGE_ASSIGNMENTS_QUERY, { agentId })
      .catch(() => null);
    return (res?.dedicated_agent_assignments ?? [])
      .filter((a) => a.off_today_date !== today)
      .map((a) => ({ locationId: a.business_location_id, slotKey: a.slot_key }));
  }

  private coverageOrderMatches(order: CoverageOrderRow, pairSet: Set<string>, knownOrderIds: Set<string>): boolean {
    if (knownOrderIds.has(order.id)) return false;
    if (!order.coverage_slot_key || !pairSet.has(`${order.business_location_id}:${order.coverage_slot_key}`)) {
      return false;
    }
    const window = order.delivery_time_windows?.[0];
    return isDedicatedEligibleOrder({
      fulfillmentTiming: order.fulfillment_timing,
      hasDeliveryWindow: !!window?.slot_id && !!window?.preferred_date,
      windowConfirmed: window?.is_confirmed,
      requireConfirmedWindow: true,
    });
  }

  private synthesizeCoverageOffer(order: CoverageOrderRow, now: Date) {
    const window = order.delivery_time_windows?.[0];
    const gateAt = order.dispatch_ready_at ?? now.toISOString();
    const businessName = order.business_location?.name || 'the store';
    return {
      orderId: order.id,
      phase: 'early',
      expiresAt: gateAt,
      offeredAt: now.toISOString(),
      estimatedEarnings: null as number | null,
      currency: order.currency,
      dismissedFromHome: false,
      details: {
        date: window?.preferred_date ?? null,
        windowStart: window?.time_slot_start ?? null,
        windowEnd: window?.time_slot_end ?? null,
        gateAt,
        businessName,
        pickupArea: designatedArea({ city: order.business_location?.address?.city, state: null }),
        dropoffArea: designatedArea(order.delivery_address),
        pickupKm: null,
        dropoffKm: null,
        distanceOrigin: null,
        commission: null,
        currency: order.currency,
        releaseCutoffAt: null,
      } satisfies DesignatedOfferPayload,
    };
  }

  private async coverageEnsureContext(
    order: DesignatedOrder | null,
    offers: DesignatedOfferRow[],
    agentId: string,
    now: Date
  ): Promise<{ agent: DedicatedEligibleAgent; slot: ResolvedDedicatedSlot; gateAt: Date; config: DedicatedAgentsConfig } | null> {
    if (!this.isPreGateDispatchable(order, offers, agentId, now)) return null;
    const window = order!.delivery_time_windows?.[0];
    const config = await this.dedicatedConfig.getConfig(isoCountryCode(order!.business_location?.address?.country));
    // Coverage Take cards are assignment-based (dedicated agents). Do not require
    // designated_first_enabled here — that flag gates proactive offer-at-ready / push.
    if (!config.enabled) return null;
    const gateAt = new Date(order!.dispatch_ready_at as string);
    const slot = await this.coverage.resolveSlot({
      locationId: order!.business_location_id,
      preferredDate: window?.preferred_date as string,
      slotId: window?.slot_id as string,
    });
    if (!slot) return null;
    // Match acceptAssignment: a live/coverage Take must not fail on slot prefs or other open offers.
    const agent =
      (await this.takeEligibleAgent(order!, slot, agentId)) ??
      (await this.takeAgentFromAssignment(order!, slot, agentId));
    if (!agent?.userId) return null;
    return { agent, slot, gateAt, config };
  }

  /** Fallback when evaluate rejects soft gates: active store/slot assignment is enough to open a quiet offer. */
  private async takeAgentFromAssignment(
    order: DesignatedOrder,
    slot: ResolvedDedicatedSlot,
    agentId: string
  ): Promise<DedicatedEligibleAgent | null> {
    if (!order.coverage_slot_key || order.coverage_slot_key !== slot.slotKey) return null;
    const res = await this.hasura
      .executeQuery<{
        dedicated_agent_assignments: Array<{ id: string; agent?: { user_id: string | null } | null }>;
      }>(
        `query TakeCoverageAssignment($agentId: uuid!, $locationId: uuid!, $slotKey: String!) {
          dedicated_agent_assignments(
            where: {
              agent_id: { _eq: $agentId }
              business_location_id: { _eq: $locationId }
              slot_key: { _eq: $slotKey }
              status: { _eq: "active" }
            }
            limit: 1
          ) { id agent { user_id } }
        }`,
        { agentId, locationId: order.business_location_id, slotKey: slot.slotKey }
      )
      .catch(() => null);
    const row = res?.dedicated_agent_assignments?.[0];
    const userId = row?.agent?.user_id ?? null;
    if (!row || !userId) return null;
    return {
      agentId,
      userId,
      assignmentId: row.id,
      isInternal: false,
      activeOrders: 0,
      outstandingDedicatedOffers: 0,
      holdAmount: 0,
      availableBalance: null,
    };
  }

  /** Coverage Take ensure: match acceptAssignment prefs/offer flags; money deferred to claim. */
  private async takeEligibleAgent(
    order: DesignatedOrder,
    slot: ResolvedDedicatedSlot,
    agentId: string
  ): Promise<DedicatedEligibleAgent | null> {
    const rail = await this.paymentRoutingService.resolveRailForBusiness(order.business_id);
    const result = await this.coverage.evaluate(this.takeEvaluateParams(order, slot, rail));
    const mine = result.eligible.find((a) => a.agentId === agentId);
    if (mine) return mine;
    return this.takeAgentDespiteMoney(result.rejected, agentId);
  }

  private takeEvaluateParams(order: DesignatedOrder, slot: ResolvedDedicatedSlot, rail: string) {
    return {
      locationId: order.business_location_id,
      slotKey: slot.slotKey,
      fulfillmentTiming: order.fulfillment_timing,
      hasDeliveryWindow: true,
      windowConfirmed: true,
      requireConfirmedWindow: true,
      rail: rail as 'mobile_money' | 'stripe',
      subtotal: Number(order.subtotal) || 0,
      currency: order.currency,
      verifiedAgentDelivery: order.verified_agent_delivery === true,
      excludeOrderId: order.id,
      ignoreSlotPrefs: true,
      ignoreOutstandingOffers: true,
      slotDate: slot.date,
      capPerSlotDay: true,
    };
  }

  private async takeAgentDespiteMoney(
    rejected: Array<{ agentId: string; assignmentId: string; reason: string }>,
    agentId: string
  ): Promise<DedicatedEligibleAgent | null> {
    const money = rejected.find(
      (a) => a.agentId === agentId && (a.reason === 'negative_balance' || a.reason === 'insufficient_balance')
    );
    if (!money) return null;
    const userId = await this.agentUserId(money.agentId);
    if (!userId) return null;
    return {
      agentId: money.agentId,
      userId,
      isInternal: false,
      assignmentId: money.assignmentId,
      activeOrders: 0,
      outstandingDedicatedOffers: 0,
      holdAmount: 0,
      availableBalance: null,
    };
  }

  private async agentUserId(agentId: string): Promise<string | null> {
    const res = await this.hasura
      .executeQuery<{ agents_by_pk: { user_id: string | null } | null }>(
        `query DesignatedAgentUser($id: uuid!) { agents_by_pk(id: $id) { user_id } }`,
        { id: agentId }
      )
      .catch(() => null);
    return res?.agents_by_pk?.user_id ?? null;
  }

  private isPreGateDispatchable(
    order: DesignatedOrder | null,
    offers: DesignatedOfferRow[],
    agentId: string,
    now: Date
  ): order is DesignatedOrder {
    if (!order) return false;
    if (order.current_status !== 'ready_for_pickup' || order.assigned_agent_id || order.fulfillment_method !== 'delivery') {
      return false;
    }
    if (offers.some((o) => o.agent_id === agentId && o.status === 'declined')) return false;
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
      return false;
    }
    const gateAt = order.dispatch_ready_at ? new Date(order.dispatch_ready_at) : null;
    return !!gateAt && gateAt.getTime() > now.getTime();
  }

  private async writeQuietEarlyOffer(
    order: DesignatedOrder,
    agent: DedicatedEligibleAgent,
    slot: ResolvedDedicatedSlot,
    gateAt: Date,
    config: DedicatedAgentsConfig,
    now: Date,
    prior: DesignatedOfferRow[]
  ): Promise<boolean> {
    const payload = await this.quietOfferPayload(order, agent.agentId, slot, gateAt, config, now);
    if (await this.refreshEarlyOfferRow(order.id, agent.agentId, gateAt, payload)) return true;
    const inserted = await this.insertQuietEarlyOffer(order, agent, payload, gateAt, now, prior);
    if (inserted) return true;
    // Conflict with a declined/other row that refresh skipped: last try refresh again.
    return this.refreshEarlyOfferRow(order.id, agent.agentId, gateAt, payload);
  }

  private async refreshEarlyOfferRow(
    orderId: string,
    agentId: string,
    gateAt: Date,
    payload: DesignatedOfferPayload
  ): Promise<boolean> {
    const refreshed = await this.hasura.executeMutation<{ update_order_offers: { affected_rows: number } | null }>(
      REFRESH_EARLY_OFFER,
      {
        orderId,
        agentId,
        expiresAt: gateAt.toISOString(),
        payload,
        earnings: payload.commission,
        currency: payload.currency,
      }
    );
    return (refreshed?.update_order_offers?.affected_rows ?? 0) > 0;
  }

  private async insertQuietEarlyOffer(
    order: DesignatedOrder,
    agent: DedicatedEligibleAgent,
    payload: DesignatedOfferPayload,
    gateAt: Date,
    now: Date,
    prior: DesignatedOfferRow[]
  ): Promise<boolean> {
    const attempt = (prior.find((o) => o.agent_id === agent.agentId)?.dedicated_attempt ?? 0) + 1;
    const objects = orderAssignmentsForLocking([
      {
        order_id: order.id,
        agent_id: agent.agentId,
        user_id: agent.userId,
        status: 'offered',
        offer_kind: 'dedicated',
        phase: 'early',
        payload,
        decline_reason: null,
        distance_km: payload.pickupKm,
        estimated_earnings: payload.commission,
        currency: payload.currency,
        expires_at: gateAt.toISOString(),
        created_at: now.toISOString(),
        responded_at: null,
        reminder_sent_at: null,
        dedicated_attempt: attempt,
      },
    ]);
    const res = await runAssignmentWrite(() =>
      this.hasura.executeMutation<{
        insert_order_offers: { returning: Array<{ agent_id: string }> } | null;
      }>(UPSERT_EARLY_OFFERS, { objects })
    );
    return (res?.insert_order_offers?.returning?.length ?? 0) > 0;
  }

  private async quietOfferPayload(
    order: DesignatedOrder,
    agentId: string,
    slot: ResolvedDedicatedSlot,
    gateAt: Date,
    config: DedicatedAgentsConfig,
    now: Date
  ): Promise<DesignatedOfferPayload> {
    const earnings = await this.agentEarnings(order);
    const origin = (await this.agentOrigins([agentId], now)).get(agentId)?.origin ?? null;
    const pickup = toPoint(order.business_location?.address?.latitude, order.business_location?.address?.longitude);
    const dropoff = toPoint(order.delivery_address?.latitude, order.delivery_address?.longitude);
    const window = order.delivery_time_windows?.[0];
    const windowStart = order.pickup_by ? new Date(order.pickup_by) : null;
    const cutoff = windowStart ? designatedReleaseCutoffAt(windowStart, config.designatedReleaseCutoffMinutes) : null;
    return {
      date: window?.preferred_date ?? slot.date,
      windowStart: window?.time_slot_start ?? slot.startTime,
      windowEnd: window?.time_slot_end ?? slot.endTime,
      gateAt: gateAt.toISOString(),
      businessName: order.business_location?.name || order.business?.name || 'the store',
      pickupArea: designatedArea({ city: order.business_location?.address?.city, state: null }),
      dropoffArea: designatedArea(order.delivery_address),
      pickupKm: origin && pickup ? Number(haversineKm(origin.point, pickup).toFixed(1)) : null,
      dropoffKm: pickup && dropoff ? Number(haversineKm(pickup, dropoff).toFixed(1)) : null,
      distanceOrigin: origin?.source ?? null,
      commission: earnings.amount,
      currency: earnings.currency,
      releaseCutoffAt: cutoff?.toISOString() ?? null,
    };
  }

  private async agentEarnings(order: DesignatedOrder): Promise<{ amount: number | null; currency: string }> {
    return this.commissionsService
      .calculateAgentEarnings(order.id, true)
      .then((e) => ({ amount: e.totalEarnings ?? null, currency: e.currency ?? order.currency }))
      .catch(() => ({ amount: null as number | null, currency: order.currency }));
  }

  private dueFor(order: DesignatedOrder, offers: DesignatedOfferRow[], now: Date, config: DedicatedAgentsConfig, timeZone: string | null) {
    const openEarly = offers.filter((o) => o.status === 'offered' && o.phase === 'early');
    const window = order.delivery_time_windows?.[0];
    const designatedAssigned =
      order.current_status === 'assigned_to_agent' && !!order.designated_accepted_at;
    return designatedDueActions({
      now,
      gateAt: order.dispatch_ready_at ? new Date(order.dispatch_ready_at) : null,
      windowStart: order.pickup_by ? new Date(order.pickup_by) : null,
      slotDate: window?.preferred_date ?? null,
      timeZone,
      openEarlyOffer: !order.assigned_agent_id && openEarly.length > 0,
      openReminderSentAt: openEarly.length > 0 && openEarly.every((o) => !!o.reminder_sent_at) ? 'sent' : null,
      designatedAssigned,
      acceptedAt: order.designated_accepted_at,
      confirmedAt: order.designated_confirmed_at,
      eveningSentAt: order.designated_evening_reminder_sent_at,
      soonSentAt: order.designated_reminder_sent_at,
      openOfferReminderMinutes: config.designatedOpenOfferReminderMinutes,
      reminderMinutesBefore: config.designatedReminderMinutesBefore,
      eveningEnabled: config.designatedEveningBeforeEnabled,
      eveningLocalMinutes: config.designatedEveningBeforeLocalMinutes,
    });
  }

  private async sendAction(order: DesignatedOrder, action: DesignatedAction, now: Date): Promise<boolean> {
    const window = order.delivery_time_windows?.[0];
    const businessName = order.business_location?.name || order.business?.name || 'the store';
    if (action === 'open_offer_reminder') {
      const res = await this.hasura.executeMutation<{
        update_order_offers: { returning: Array<{ agent_id: string; user_id: string | null }> } | null;
      }>(CLAIM_OFFER_REMINDERS, { orderId: order.id, at: now.toISOString() });
      const rows = res?.update_order_offers?.returning ?? [];
      const tz = await this.timeZoneFor(order);
      const gateTime = order.dispatch_ready_at ? this.localTime(new Date(order.dispatch_ready_at), tz) : '';
      const locales = await this.locales(rows.map((r) => r.user_id).filter((u): u is string => !!u));
      for (const r of rows) {
        if (!r.user_id) continue;
        const msg = buildDesignatedOpenOfferReminderMessage({ businessName, gateTime, preferredLanguage: locales.get(r.user_id) });
        await this.notifications
          .sendOrderOfferPush({ userId: r.user_id, title: msg.title, body: msg.body, orderId: order.id, expiresAt: order.dispatch_ready_at ?? now.toISOString() })
          .catch(() => undefined);
        emitServerSiteEvent(this.siteEventsService, 'dedicated.open_offer_reminder_sent', { orderId: order.id, agentId: r.agent_id });
      }
      return rows.length > 0;
    }
    const column = action === 'evening_reminder' ? 'designated_evening_reminder_sent_at' : 'designated_reminder_sent_at';
    if (!(await this.claimStamp(order.id, column, now))) return false;
    const userId = order.assigned_agent?.user_id;
    if (!userId) return false;
    const msg = buildDesignatedPickupReminderMessage({
      kind: action === 'evening_reminder' ? 'evening' : 'soon',
      orderNumber: order.order_number,
      businessName,
      date: window?.preferred_date ?? '',
      window: designatedWindowLabel(window?.time_slot_start, window?.time_slot_end),
      preferredLanguage: order.assigned_agent?.user?.preferred_language,
    });
    await this.notifications
      .sendDedicatedOrderNotice({
        userId,
        title: msg.title,
        body: msg.body,
        messageType: DESIGNATED_FIRST_MESSAGE_TYPES.pickupReminder,
        orderId: order.id,
        event: action === 'evening_reminder' ? 'dedicated.reminder_evening' : 'dedicated.reminder_soon',
        persona: 'agent',
      })
      .catch(() => undefined);
    emitServerSiteEvent(this.siteEventsService, 'dedicated.reminder_sent', {
      orderId: order.id,
      agentId: order.assigned_agent_id,
      kind: action,
    });
    return true;
  }

  private async sendEarlyOffers(
    order: DesignatedOrder,
    slot: ResolvedDedicatedSlot,
    agents: DedicatedEligibleAgent[],
    gateAt: Date,
    config: DedicatedAgentsConfig,
    now: Date,
    prior: DesignatedOfferRow[]
  ): Promise<string[]> {
    const earnings = await this.commissionsService
      .calculateAgentEarnings(order.id, true)
      .then((e) => ({ amount: e.totalEarnings ?? null, currency: e.currency ?? order.currency }))
      .catch(() => ({ amount: null as number | null, currency: order.currency }));
    const origins = await this.agentOrigins(agents.map((a) => a.agentId), now);
    const pickup = toPoint(order.business_location?.address?.latitude, order.business_location?.address?.longitude);
    const dropoff = toPoint(order.delivery_address?.latitude, order.delivery_address?.longitude);
    const window = order.delivery_time_windows?.[0];
    const windowStart = order.pickup_by ? new Date(order.pickup_by) : null;
    const cutoff = windowStart ? designatedReleaseCutoffAt(windowStart, config.designatedReleaseCutoffMinutes) : null;
    const businessName = order.business_location?.name || order.business?.name || 'the store';
    const priorAttempts = new Map(prior.map((o) => [o.agent_id, o.dedicated_attempt ?? 1]));
    const payloadFor = (agentId: string): DesignatedOfferPayload => {
      const origin = origins.get(agentId)?.origin ?? null;
      return {
        date: window?.preferred_date ?? slot.date,
        windowStart: window?.time_slot_start ?? slot.startTime,
        windowEnd: window?.time_slot_end ?? slot.endTime,
        gateAt: gateAt.toISOString(),
        businessName,
        pickupArea: designatedArea({ city: order.business_location?.address?.city, state: null }),
        dropoffArea: designatedArea(order.delivery_address),
        pickupKm: origin && pickup ? Number(haversineKm(origin.point, pickup).toFixed(1)) : null,
        dropoffKm: pickup && dropoff ? Number(haversineKm(pickup, dropoff).toFixed(1)) : null,
        distanceOrigin: origin?.source ?? null,
        commission: earnings.amount,
        currency: earnings.currency,
        releaseCutoffAt: cutoff?.toISOString() ?? null,
      };
    };
    const objects = orderAssignmentsForLocking(
      agents.map((a) => {
        const payload = payloadFor(a.agentId);
        return {
          order_id: order.id,
          agent_id: a.agentId,
          user_id: a.userId,
          status: 'offered',
          offer_kind: 'dedicated',
          phase: 'early',
          payload,
          decline_reason: null,
          distance_km: payload.pickupKm,
          estimated_earnings: earnings.amount,
          currency: earnings.currency,
          expires_at: gateAt.toISOString(),
          created_at: now.toISOString(),
          responded_at: null,
          reminder_sent_at: null,
          dedicated_attempt: (priorAttempts.get(a.agentId) ?? 0) + 1,
        };
      })
    );
    const res = await runAssignmentWrite(() =>
      this.hasura.executeMutation<{ insert_order_offers: { returning: Array<{ agent_id: string }> } | null }>(
        UPSERT_EARLY_OFFERS,
        { objects }
      )
    );
    const written = new Set((res?.insert_order_offers?.returning ?? []).map((r) => r.agent_id));
    const sent = agents.filter((a) => written.has(a.agentId));
    const ttlSeconds = Math.max(1, Math.round((gateAt.getTime() - now.getTime()) / 1000));
    for (const a of sent) {
      const payload = payloadFor(a.agentId);
      const msg = buildDesignatedEarlyOfferMessage({
        date: payload.date ?? '',
        window: designatedWindowLabel(payload.windowStart, payload.windowEnd),
        businessName,
        pickupKm: payload.pickupKm,
        area: payload.dropoffArea,
        dropoffKm: payload.dropoffKm,
        commission: payload.commission,
        currency: payload.currency,
        preferredLanguage: origins.get(a.agentId)?.language ?? null,
      });
      await this.notifications
        .sendOrderOfferPush({
          userId: a.userId as string,
          title: msg.title,
          body: msg.body,
          orderId: order.id,
          expiresAt: gateAt.toISOString(),
          ttlSeconds,
        })
        .catch(() => undefined);
      emitServerSiteEvent(this.siteEventsService, 'dedicated.early_offer_sent', {
        orderId: order.id,
        agentId: a.agentId,
        assignmentId: a.assignmentId,
        isInternal: a.isInternal,
        businessLocationId: order.business_location_id,
        slotKey: slot.slotKey,
        slotDate: slot.date,
        gateAt: gateAt.toISOString(),
        distanceOrigin: payload.distanceOrigin,
      });
    }
    return sent.map((a) => a.agentId);
  }

  private async autoAssignInternal(
    order: DesignatedOrder,
    slot: ResolvedDedicatedSlot,
    agent: DedicatedEligibleAgent,
    config: DedicatedAgentsConfig
  ): Promise<boolean> {
    const res = await this.hasura.executeQuery<{
      agents_by_pk: {
        id: string;
        is_verified: boolean | null;
        is_internal: boolean | null;
        user: { id: string; first_name: string | null; last_name: string | null } | null;
      } | null;
    }>(
      `query DesignatedAutoAgent($id: uuid!) { agents_by_pk(id: $id) { id is_verified is_internal user { id first_name last_name } } }`,
      { id: agent.agentId }
    );
    const row = res?.agents_by_pk;
    if (!row?.user) return false;
    const windowStart = order.pickup_by ? new Date(order.pickup_by) : null;
    const cutoff = windowStart ? designatedReleaseCutoffAt(windowStart, config.designatedReleaseCutoffMinutes) : null;
    try {
      await this.claimer().claimOrderForAgent({
        orderId: order.id,
        user: row.user,
        agent: { id: row.id, is_verified: row.is_verified, is_internal: row.is_internal },
        fundsCheckSource: 'claim',
        assignment: {
          source: 'dedicated_auto',
          dedicatedAssignmentId: agent.assignmentId,
          releaseUntil: cutoff && cutoff.getTime() > Date.now() ? cutoff.toISOString() : null,
          maxActiveOrders: config.maxActiveOrders,
          countOffers: true,
        },
      });
    } catch (error) {
      this.logger.warn(`Designated auto-assign of ${order.order_number} failed; offering instead: ${this.msg(error)}`);
      return false;
    }
    emitServerSiteEvent(this.siteEventsService, 'dedicated.auto_assigned', {
      orderId: order.id,
      agentId: agent.agentId,
      assignmentId: agent.assignmentId,
      slotKey: slot.slotKey,
      slotDate: slot.date,
      releaseUntil: cutoff?.toISOString() ?? null,
      atReady: true,
    });
    return true;
  }

  private async eligibleAgents(order: DesignatedOrder, slot: ResolvedDedicatedSlot): Promise<DedicatedEligibleAgent[]> {
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
      capPerSlotDay: true,
    });
    return result.eligible;
  }

  private async agentOrigins(
    agentIds: string[],
    now: Date
  ): Promise<Map<string, { origin: ReturnType<typeof pickDistanceOrigin>; language: string | null }>> {
    const out = new Map<string, { origin: ReturnType<typeof pickDistanceOrigin>; language: string | null }>();
    if (agentIds.length === 0) return out;
    try {
      const res = await this.hasura.executeQuery<{
        agents: Array<{
          id: string;
          user?: { preferred_language?: string | null } | null;
          agent_locations?: Array<{ latitude: unknown; longitude: unknown; updated_at: string | null }>;
          agent_addresses?: Array<{ address?: { latitude?: unknown; longitude?: unknown; is_primary?: boolean | null } | null }>;
        }>;
      }>(AGENT_ORIGINS_QUERY, { ids: agentIds });
      for (const a of res?.agents ?? []) {
        const loc = a.agent_locations?.[0];
        const gpsPoint = loc ? toPoint(loc.latitude, loc.longitude) : null;
        const addresses = [...(a.agent_addresses ?? [])].sort((x, y) => Number(!!y.address?.is_primary) - Number(!!x.address?.is_primary));
        const home = addresses.map((r) => toPoint(r.address?.latitude, r.address?.longitude)).find((p) => !!p) ?? null;
        out.set(a.id, {
          origin: pickDistanceOrigin(gpsPoint ? { ...gpsPoint, updatedAt: loc?.updated_at ?? null } : null, home, now),
          language: a.user?.preferred_language ?? null,
        });
      }
    } catch (error) {
      this.logger.warn(`Designated agent origins lookup failed: ${this.msg(error)}`);
    }
    return out;
  }

  private async locales(userIds: string[]): Promise<Map<string, string | null>> {
    if (userIds.length === 0) return new Map();
    const res = await this.hasura
      .executeQuery<{ users: Array<{ id: string; preferred_language: string | null }> }>(
        `query DesignatedLocales($ids: [uuid!]!) { users(where: { id: { _in: $ids } }) { id preferred_language } }`,
        { ids: userIds }
      )
      .catch(() => null);
    return new Map((res?.users ?? []).map((u) => [u.id, u.preferred_language]));
  }

  private async timeZoneFor(order: DesignatedOrder): Promise<string | null> {
    const window = order.delivery_time_windows?.[0];
    if (!window?.preferred_date || !window.slot_id) return null;
    const slot = await this.coverage
      .resolveSlot({ locationId: order.business_location_id, preferredDate: window.preferred_date, slotId: window.slot_id })
      .catch(() => null);
    return slot?.timeZone ?? null;
  }

  private localTime(at: Date, timeZone: string | null): string {
    try {
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timeZone ?? 'UTC' }).format(at);
    } catch {
      return at.toISOString().slice(11, 16);
    }
  }

  private async scheduleTick(orderId: string, now: Date, config: DedicatedAgentsConfig): Promise<void> {
    try {
      const { order, offers } = await this.load(orderId);
      if (!order) return;
      const { nextAt } = this.dueFor(order, offers, now, config, await this.timeZoneFor(order));
      if (!nextAt) return;
      await this.waitAndExecute.scheduleDedicatedHeadsUpReping(orderId, Math.ceil((nextAt.getTime() - now.getTime()) / 1000));
    } catch (error) {
      this.logger.warn(`Designated tick schedule failed for ${orderId}: ${this.msg(error)}`);
    }
  }

  private async stampMode(orderId: string, mode: 'designated_first' | 'fallback'): Promise<void> {
    await this.hasura.executeMutation(STAMP_MODE, { id: orderId, mode }).catch(() => undefined);
    if (mode === 'designated_first') {
      // A 'fallback' stamp from an earlier attempt (nobody reachable) upgrades once someone is.
      await this.hasura
        .executeMutation(
          `mutation UpgradeDesignatedMode($id: uuid!) {
            update_orders(where: { id: { _eq: $id }, dispatch_mode: { _eq: "fallback" } }, _set: { dispatch_mode: "designated_first" }) { affected_rows }
          }`,
          { id: orderId }
        )
        .catch(() => undefined);
    }
  }

  private async claimStamp(orderId: string, column: string, at: Date): Promise<boolean> {
    const res = await this.hasura.executeMutation<{ update_orders: { affected_rows: number } | null }>(
      CLAIM_ORDER_STAMP(column),
      { id: orderId, at: at.toISOString() }
    );
    return (res?.update_orders?.affected_rows ?? 0) > 0;
  }

  private claimer(): DedicatedOrderClaimer {
    return this.moduleRef.get<DedicatedOrderClaimer>(DEDICATED_ORDER_CLAIMER, { strict: false });
  }

  private reassigner(): { reassignOrder(orderId: string, reason: string, options?: { skipReliabilityPenalty?: boolean }): Promise<unknown> } | null {
    try {
      // Lazy: OrderReassignmentService -> OrderOffersService -> this service.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { OrderReassignmentService } = require('./order-reassignment.service');
      return this.moduleRef.get(OrderReassignmentService, { strict: false });
    } catch {
      return null;
    }
  }

  private offersService(): { runDispatchRound(orderId: string, round: number): Promise<void> } | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { OrderOffersService } = require('./order-offers.service');
      return this.moduleRef.get(OrderOffersService, { strict: false });
    } catch {
      return null;
    }
  }

  private msg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
