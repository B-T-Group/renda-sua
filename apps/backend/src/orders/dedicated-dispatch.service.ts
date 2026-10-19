import { HttpException, HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CommissionsService } from '../commissions/commissions.service';
import { DedicatedAgentsConfigService } from '../dedicated-agents/dedicated-agents-config.service';
import type { OfferDeclineReason } from '../dedicated-agents/dedicated-agents.constants';
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
  buildDedicatedAutoAssignedMessage,
  buildDedicatedOfferMessage,
  DEDICATED_ORDER_MESSAGE_TYPES,
} from '../notifications/dedicated-order-push.messages';
import { NotificationsService } from '../notifications/notifications.service';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { dedicatedAcceptRefusal } from './dedicated-accept-refusal.messages';
import { isoCountryCode } from './delivery-pricing.util';
import {
  DEDICATED_ORDER_CLAIMER,
  type ClaimAssignment,
  type DedicatedOrderClaimer,
} from './dedicated-claim.port';

/** Reasons the agent's own dedicated-offer accept is refused before the claim (money is the claim's job). */
const MONEY_REASONS: ReadonlySet<string> = new Set(['negative_balance', 'insufficient_balance']);

export type DedicatedFallbackOutcome =
  /** Flag off, ASAP, unconfirmed or uncovered order, or nobody eligible: today's path continues. */
  | { kind: 'none' }
  /** The only eligible agent was internal and now holds the order. */
  | { kind: 'auto_assigned'; agentId: string }
  /** Dedicated offers just went out; check again once they expire. */
  | { kind: 'offered'; agentIds: string[]; waitSeconds: number }
  /** Offers from an earlier callback are still live. */
  | { kind: 'pending'; waitSeconds: number }
  /** Offers from an earlier callback were all declined or expired: exhaustion may proceed. */
  | { kind: 'done' };

interface DispatchOfferRow {
  agent_id: string;
  user_id: string | null;
  status: string;
  expires_at: string;
}

export interface DedicatedDispatchOrder {
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
  business?: { name?: string | null } | null;
  business_location?: { name?: string | null; address?: { country?: string | null } | null } | null;
  delivery_time_windows?: Array<{
    slot_id: string | null;
    preferred_date: string | null;
    is_confirmed: boolean | null;
  }>;
}

const DISPATCH_ORDER_QUERY = `
  query DedicatedDispatchOrder($orderId: uuid!) {
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
      business { name }
      business_location { name address { country } }
      delivery_time_windows(order_by: { created_at: desc }, limit: 1) {
        slot_id
        preferred_date
        is_confirmed
      }
    }
    order_offers(where: { order_id: { _eq: $orderId }, offer_kind: { _eq: "dedicated" } }) {
      agent_id
      user_id
      status
      expires_at
    }
  }
`;

const UPSERT_DEDICATED_OFFERS = `
  mutation UpsertDedicatedOffers($objects: [order_offers_insert_input!]!) {
    insert_order_offers(
      objects: $objects
      on_conflict: {
        constraint: order_offers_order_agent_unique
        # QA #607 N3: only an expired row is re-offered; a declined (or live,
        # accepted, cancelled) row is never brought back by an overlapping run.
        where: { status: { _eq: expired } }
        update_columns: [
          status
          offer_kind
          decline_reason
          distance_km
          estimated_earnings
          currency
          expires_at
          created_at
          responded_at
        ]
      }
    ) {
      affected_rows
    }
  }
`;

const EXPIRE_DEDICATED_OFFERS = `
  mutation ExpireDedicatedOffers($orderId: uuid!, $now: timestamptz!) {
    update_order_offers(
      where: {
        order_id: { _eq: $orderId }
        offer_kind: { _eq: "dedicated" }
        status: { _eq: "offered" }
        expires_at: { _lte: $now }
      }
      _set: { status: "expired", responded_at: $now }
    ) {
      returning { agent_id }
    }
  }
`;

/** Saved locale of each offered agent (PR 3 notice rule: saved locale, else the default). */
const OFFER_RECIPIENT_LOCALES = `
  query DedicatedOfferLocales($userIds: [uuid!]!) {
    users(where: { id: { _in: $userIds } }) {
      id
      preferred_language
    }
  }
`;

const AGENT_FOR_SYSTEM_CLAIM = `
  query DedicatedClaimAgent($agentId: uuid!) {
    agents_by_pk(id: $agentId) {
      id
      is_verified
      is_internal
      user { id first_name last_name preferred_language }
    }
  }
`;

/**
 * #594 PR 5: dedicated fallback at the existing scheduled dispatch gate
 * (OrderOffersService), behind `dedicated_agents_enabled`. Applies only to an
 * order placed on dedicated coverage (`coverage_slot_key` set, PE: no
 * backfill) whose scheduled window the business CONFIRMED. One eligible
 * internal agent is auto-assigned; otherwise every eligible agent gets a
 * dedicated offer (TTL `dedicated_offer_ttl_seconds`) and the first accept
 * wins through the atomic claim. Re-entry from SFN retries never re-offers:
 * dedicated offer rows on the order are the idempotency guard.
 */
@Injectable()
export class DedicatedDispatchService {
  private readonly logger = new Logger(DedicatedDispatchService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly dedicatedConfig: DedicatedAgentsConfigService,
    private readonly coverage: DedicatedCoverageService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly notificationsService: NotificationsService,
    private readonly commissionsService: CommissionsService,
    private readonly moduleRef: ModuleRef,
    @Optional()
    private readonly siteEventsService?: SiteEventsService
  ) {}

  /**
   * Called by the dispatch gate when a round found nobody nearby and before
   * marking dispatch exhausted. Never throws: a failure means today's path.
   */
  async fallback(orderId: string): Promise<DedicatedFallbackOutcome> {
    const none: DedicatedFallbackOutcome = { kind: 'none' };
    try {
      const { order, offers } = await this.loadOrder(orderId);
      if (!order || !this.isDispatchable(order) || !order.coverage_slot_key) return none;
      const country = isoCountryCode(order.business_location?.address?.country);
      if (!(await this.dedicatedConfig.isEnabled(country))) return none;
      const window = order.delivery_time_windows?.[0];
      if (
        !isDedicatedEligibleOrder({
          fulfillmentTiming: order.fulfillment_timing,
          hasDeliveryWindow: !!window?.slot_id && !!window?.preferred_date,
          windowConfirmed: window?.is_confirmed,
          requireConfirmedWindow: true,
        })
      ) {
        return none;
      }
      if (offers.length > 0) return this.followUp(order, offers);

      const slot = await this.coverage.resolveSlot({
        locationId: order.business_location_id,
        preferredDate: window?.preferred_date as string,
        slotId: window?.slot_id as string,
      });
      if (!slot) return none;
      const rail = await this.paymentRoutingService.resolveRailForBusiness(order.business_id);
      const eligible = await this.coverage.eligibleAgents({
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
      const reachable = eligible.filter((a) => !!a.userId);
      if (reachable.length === 0) return none;

      if (reachable.length === 1 && reachable[0].isInternal) {
        const failure = await this.autoAssign(order, slot, reachable[0], country);
        if (!failure) return { kind: 'auto_assigned', agentId: reachable[0].agentId };
        this.logger.warn(
          `Dedicated auto-assign of order ${order.order_number} to agent ${reachable[0].agentId} failed (${failure}); standard dispatch continues`
        );
        return none;
      }
      const config = await this.dedicatedConfig.getConfig(country);
      await this.offer(order, slot, reachable, config.offerTtlSeconds);
      return {
        kind: 'offered',
        agentIds: reachable.map((a) => a.agentId),
        waitSeconds: config.offerTtlSeconds,
      };
    } catch (error) {
      this.logger.warn(
        `Dedicated fallback failed for order ${orderId}; standard dispatch continues: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return none;
    }
  }

  /**
   * Round 1 of an order placed on dedicated coverage whose window was never
   * confirmed: it dispatches under today's rules (PE), and this records it.
   */
  async noteDispatchStarted(orderId: string, candidateCount: number): Promise<void> {
    try {
      const { order } = await this.loadOrder(orderId);
      if (!order?.coverage_slot_key || order.fulfillment_timing !== 'scheduled') return;
      const window = order.delivery_time_windows?.[0];
      if (window?.is_confirmed === true) return;
      const country = isoCountryCode(order.business_location?.address?.country);
      if (!(await this.dedicatedConfig.isEnabled(country))) return;
      emitServerSiteEvent(this.siteEventsService, 'dedicated.coverage_unconfirmed_at_dispatch', {
        orderId: order.id,
        businessId: order.business_id,
        businessLocationId: order.business_location_id,
        sellerCountry: country,
        coverageSlotKey: order.coverage_slot_key,
        preferredDate: window?.preferred_date ?? null,
        hasWindow: !!window,
        nearbyCandidateCount: candidateCount,
      });
    } catch (error) {
      this.logger.warn(
        `coverage_unconfirmed_at_dispatch check failed for ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * The agent accepting their own dedicated offer: re-check AC-E2 (not
   * counting this order's offer) for everything but money, which the claim's
   * hold check answers with its usual errors. Returns how the assignment is stamped.
   */
  async acceptAssignment(orderId: string, agentId: string): Promise<ClaimAssignment> {
    const { order, offers } = await this.loadOrder(orderId);
    const refuse = (reason: string) => this.refuseAccept(reason, offers, agentId);
    if (!order) throw await refuse('slot_unavailable');
    // Flag turned off while the offer was live: nobody qualifies as dedicated any more.
    const country = isoCountryCode(order.business_location?.address?.country);
    if (!(await this.dedicatedConfig.isEnabled(country))) throw await refuse('dedicated_disabled');
    const window = order.delivery_time_windows?.[0];
    const slot =
      window?.slot_id && window.preferred_date
        ? await this.coverage.resolveSlot({
            locationId: order.business_location_id,
            preferredDate: window.preferred_date,
            slotId: window.slot_id,
          })
        : null;
    if (!slot) throw await refuse('slot_unavailable');
    const rail = await this.paymentRoutingService.resolveRailForBusiness(order.business_id);
    const result = await this.coverage.evaluate({
      locationId: order.business_location_id,
      slotKey: slot.slotKey,
      fulfillmentTiming: order.fulfillment_timing,
      hasDeliveryWindow: true,
      windowConfirmed: window?.is_confirmed,
      requireConfirmedWindow: true,
      rail,
      subtotal: Number(order.subtotal) || 0,
      currency: order.currency,
      verifiedAgentDelivery: order.verified_agent_delivery === true,
      excludeOrderId: order.id,
      // QA #607 N4: the agent's other live offers don't block this accept; the
      // claim re-checks active orders < cap under the agent lock (N1).
      ignoreOutstandingOffers: true,
      slotDate: slot.date,
    });
    const { maxActiveOrders } = await this.dedicatedConfig.getConfig(country);
    const stamp = (assignmentId: string): ClaimAssignment => ({
      source: 'dedicated_offer',
      dedicatedAssignmentId: assignmentId,
      maxActiveOrders,
      countOffers: false,
    });
    const mine = result.eligible.find((a) => a.agentId === agentId);
    if (mine) return stamp(mine.assignmentId);
    const rejected = result.rejected.find((a) => a.agentId === agentId);
    if (rejected && MONEY_REASONS.has(rejected.reason)) {
      return stamp(rejected.assignmentId);
    }
    throw await refuse(rejected?.reason ?? 'not_assigned');
  }

  /** `handleOrderAssigned` saw the winner's dedicated offer accepted. */
  onOfferAccepted(orderId: string, agentId: string): void {
    emitServerSiteEvent(this.siteEventsService, 'dedicated.offer_accepted', { orderId, agentId });
  }

  onOfferDeclined(orderId: string, agentId: string, reason: OfferDeclineReason | null): void {
    emitServerSiteEvent(this.siteEventsService, 'dedicated.offer_declined', {
      orderId,
      agentId,
      reason,
    });
  }

  private async followUp(
    order: DedicatedDispatchOrder,
    offers: DispatchOfferRow[]
  ): Promise<DedicatedFallbackOutcome> {
    const now = Date.now();
    const live = offers.filter(
      (o) => o.status === 'offered' && new Date(o.expires_at).getTime() > now
    );
    if (live.length > 0) {
      const last = Math.max(...live.map((o) => new Date(o.expires_at).getTime()));
      return { kind: 'pending', waitSeconds: Math.max(1, Math.ceil((last - now) / 1000)) };
    }
    const res = await this.hasuraSystemService.executeMutation<{
      update_order_offers: { returning: Array<{ agent_id: string }> } | null;
    }>(EXPIRE_DEDICATED_OFFERS, { orderId: order.id, now: new Date(now).toISOString() });
    for (const row of res?.update_order_offers?.returning ?? []) {
      emitServerSiteEvent(this.siteEventsService, 'dedicated.offer_expired', {
        orderId: order.id,
        agentId: row.agent_id,
      });
    }
    return { kind: 'done' };
  }

  private async autoAssign(
    order: DedicatedDispatchOrder,
    slot: ResolvedDedicatedSlot,
    agent: DedicatedEligibleAgent,
    country: string | null
  ): Promise<string | null> {
    const res = await this.hasuraSystemService.executeQuery<{
      agents_by_pk: {
        id: string;
        is_verified: boolean | null;
        is_internal: boolean | null;
        user: { id: string; first_name: string | null; last_name: string | null; preferred_language: string | null } | null;
      } | null;
    }>(AGENT_FOR_SYSTEM_CLAIM, { agentId: agent.agentId });
    const row = res?.agents_by_pk;
    if (!row?.user) return 'agent_not_found';
    const config = await this.dedicatedConfig.getConfig(country);
    const releaseUntil = new Date(Date.now() + config.autoAssignReleaseSeconds * 1000).toISOString();
    try {
      await this.claimer().claimOrderForAgent({
        orderId: order.id,
        user: row.user,
        agent: { id: row.id, is_verified: row.is_verified, is_internal: row.is_internal },
        fundsCheckSource: 'claim',
        assignment: {
          source: 'dedicated_auto',
          dedicatedAssignmentId: agent.assignmentId,
          releaseUntil,
          maxActiveOrders: config.maxActiveOrders,
          countOffers: true,
        },
      });
    } catch (error) {
      return error instanceof HttpException ? JSON.stringify(error.getResponse()) : String(error);
    }
    emitServerSiteEvent(this.siteEventsService, 'dedicated.auto_assigned', {
      orderId: order.id,
      agentId: agent.agentId,
      assignmentId: agent.assignmentId,
      businessLocationId: order.business_location_id,
      slotKey: slot.slotKey,
      slotDate: slot.date,
      releaseUntil,
    });
    const msg = buildDedicatedAutoAssignedMessage({
      orderNumber: order.order_number,
      storeName: this.storeName(order),
      slotKey: slot.slotKey,
      preferredLanguage: row.user.preferred_language,
    });
    await this.notificationsService
      .sendDedicatedOrderNotice({
        userId: row.user.id,
        title: msg.title,
        body: msg.body,
        messageType: DEDICATED_ORDER_MESSAGE_TYPES.autoAssigned,
        orderId: order.id,
        event: 'dedicated.auto_assigned',
        persona: 'agent',
      })
      .catch(() => undefined);
    return null;
  }

  private async offer(
    order: DedicatedDispatchOrder,
    slot: ResolvedDedicatedSlot,
    agents: DedicatedEligibleAgent[],
    ttlSeconds: number
  ): Promise<void> {
    const earnings = await this.commissionsService
      .calculateAgentEarnings(order.id, true)
      .then((e) => ({ amount: e.totalEarnings ?? null, currency: e.currency ?? order.currency }))
      .catch(() => ({ amount: null, currency: order.currency }));
    const offeredAt = new Date();
    const expiresAt = new Date(offeredAt.getTime() + ttlSeconds * 1000).toISOString();
    // Agent-id order, like every multi-agent dedicated write (QA L4); retried on 40P01.
    const objects = orderAssignmentsForLocking(
      agents.map((a) => ({
        order_id: order.id,
        agent_id: a.agentId,
        user_id: a.userId,
        status: 'offered',
        offer_kind: 'dedicated',
        decline_reason: null,
        distance_km: null,
        estimated_earnings: earnings.amount,
        currency: earnings.currency,
        expires_at: expiresAt,
        created_at: offeredAt.toISOString(),
        responded_at: null,
      }))
    );
    await runAssignmentWrite(() =>
      this.hasuraSystemService.executeMutation(UPSERT_DEDICATED_OFFERS, { objects })
    );
    const storeName = this.storeName(order);
    const locales = await this.loadLocales(agents.map((a) => a.userId as string));
    await Promise.all(
      agents.map((a) => {
        const msg = buildDedicatedOfferMessage({
          storeName,
          slotKey: slot.slotKey,
          preferredLanguage: locales.get(a.userId as string) ?? null,
        });
        return this.notificationsService
          .sendOrderOfferPush({
            userId: a.userId as string,
            title: msg.title,
            body: msg.body,
            orderId: order.id,
            expiresAt,
            ttlSeconds,
          })
          .catch(() => undefined);
      })
    );
    for (const a of agents) {
      emitServerSiteEvent(this.siteEventsService, 'dedicated.offer_sent', {
        orderId: order.id,
        agentId: a.agentId,
        assignmentId: a.assignmentId,
        isInternal: a.isInternal,
        holdAmount: a.holdAmount,
        businessLocationId: order.business_location_id,
        slotKey: slot.slotKey,
        slotDate: slot.date,
        ttlSeconds,
        offerCount: agents.length,
      });
    }
  }

  /** A lookup failure only costs the locale: the push goes out in the default language. */
  private async loadLocales(userIds: string[]): Promise<Map<string, string | null>> {
    try {
      const res = await this.hasuraSystemService.executeQuery<{
        users: Array<{ id: string; preferred_language: string | null }>;
      }>(OFFER_RECIPIENT_LOCALES, { userIds });
      return new Map((res?.users ?? []).map((u) => [u.id, u.preferred_language]));
    } catch (error) {
      this.logger.warn(
        `Offer locale lookup failed; default language used: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return new Map();
    }
  }

  private claimer(): DedicatedOrderClaimer {
    return this.moduleRef.get<DedicatedOrderClaimer>(DEDICATED_ORDER_CLAIMER, { strict: false });
  }

  private isDispatchable(order: DedicatedDispatchOrder): boolean {
    return (
      order.current_status === 'ready_for_pickup' &&
      !order.assigned_agent_id &&
      order.fulfillment_method === 'delivery'
    );
  }

  private storeName(order: DedicatedDispatchOrder): string {
    return order.business_location?.name || order.business?.name || 'a store';
  }

  /**
   * 409 for a refused dedicated accept: `error` stays DEDICATED_OFFER_INELIGIBLE,
   * `code` is the client-facing code (DEDICATED_DISABLED once the flag is off)
   * and `message` is in the agent's saved language (default language otherwise).
   */
  private async refuseAccept(reason: string, offers: DispatchOfferRow[], agentId: string): Promise<HttpException> {
    const userId = offers.find((o) => o.agent_id === agentId)?.user_id ?? null;
    const locales = userId ? await this.loadLocales([userId]) : new Map<string, string | null>();
    const { code, message } = dedicatedAcceptRefusal(reason, userId ? locales.get(userId) : null);
    return new HttpException(
      { message, error: 'DEDICATED_OFFER_INELIGIBLE', code, reason },
      HttpStatus.CONFLICT
    );
  }

  private async loadOrder(
    orderId: string
  ): Promise<{ order: DedicatedDispatchOrder | null; offers: DispatchOfferRow[] }> {
    const res = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: DedicatedDispatchOrder | null;
      order_offers: DispatchOfferRow[];
    }>(DISPATCH_ORDER_QUERY, { orderId });
    return { order: res?.orders_by_pk ?? null, offers: res?.order_offers ?? [] };
  }
}
