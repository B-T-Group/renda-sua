import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { haversineDistanceKm } from '../common/agent-proximity.util';
import { CommissionsService } from '../commissions/commissions.service';
import type { Configuration } from '../config/configuration';
import { EligibleAgentsQueryService } from '../delivery-availability/eligible-agents-query.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

/** Final "round" value used to signal the exhaustion check rather than a real dispatch round. */
const EXHAUSTION_CHECK_ROUND = 3;

interface OfferOrderDetails {
  id: string;
  order_number: string;
  current_status: string;
  assigned_agent_id: string | null;
  fulfillment_method: string | null;
  currency: string;
  verified_agent_delivery: boolean;
  dispatch_ready_at: string | null;
  dispatch_round: number;
  business_location?: {
    name?: string | null;
    address?: {
      country?: string | null;
      state?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  } | null;
  business?: { name?: string | null } | null;
}

interface CandidateAgent {
  agentId: string;
  userId: string;
  distanceKm: number;
}

interface OfferAddress {
  address_line_1?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface OfferRow {
  status: string;
  distance_km: number | string | null;
  estimated_earnings: number | string | null;
  currency: string | null;
  expires_at: string;
  order: {
    id: string;
    order_number: string;
    current_status: string;
    assigned_agent_id: string | null;
    business?: { name?: string | null } | null;
    business_location?: {
      name?: string | null;
      address?: OfferAddress | null;
    } | null;
    delivery_address?: OfferAddress | null;
  } | null;
}

export interface OfferDetailsResponse {
  success: boolean;
  active: boolean;
  offer: {
    orderId: string;
    orderNumber: string;
    expiresAt: string;
    distanceKm: number | null;
    estimatedEarnings: number | null;
    currency: string | null;
    estimatedDeliveryMinutes: number | null;
    pickup: {
      businessName: string | null;
      city: string | null;
      state: string | null;
    };
    dropoff: {
      city: string | null;
      state: string | null;
    };
  } | null;
}

@Injectable()
export class OrderOffersService {
  private readonly logger = new Logger(OrderOffersService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly commissionsService: CommissionsService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<Configuration>,
    private readonly eligibleAgentsQueryService: EligibleAgentsQueryService,
    private readonly waitAndExecuteScheduleService: WaitAndExecuteScheduleService
  ) {}

  private get ttlSeconds(): number {
    return this.configService.get('orderOffers')?.ttlSeconds ?? 30;
  }

  private get maxAgents(): number {
    return this.configService.get('orderOffers')?.maxAgents ?? 5;
  }

  private get round1RadiusKm(): number {
    return this.configService.get('orderOffers')?.round1RadiusKm ?? 8;
  }

  private get round2RadiusKm(): number {
    return this.configService.get('orderOffers')?.round2RadiusKm ?? 20;
  }

  private get roundGapSeconds(): number {
    return (
      this.configService.get('orderOffers')?.roundGapSeconds ??
      this.ttlSeconds
    );
  }

  /**
   * Entry point when an order becomes claimable (ready_for_pickup). If the
   * dispatch gate (dispatch_ready_at) is still in the future, this is a
   * no-op: `scheduleAgentDispatchGate` in OrdersService already scheduled
   * the round 1 release via Step Functions. Otherwise dispatch round 1 now.
   */
  async dispatchOrderOffers(orderId: string): Promise<void> {
    try {
      const order = await this.getOrderForOffer(orderId);
      if (!order || !this.isDispatchable(order)) return;

      if (this.isDispatchGateOpen(order)) {
        await this.runDispatchRound(orderId, 1);
      }
    } catch (error) {
      this.logger.error(
        `Failed to dispatch order offers for ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Run a single dispatch round (1 = close radius, 2 = wide radius) or the
   * final exhaustion check (round 3). Called directly when the dispatch gate
   * opens immediately, and via the internal endpoint when Step Functions
   * fires a scheduled round-release/exhaustion-check callback. Idempotent on
   * `orders.dispatch_round` so duplicate callbacks are harmless.
   */
  async runDispatchRound(orderId: string, round: number): Promise<void> {
    try {
      const order = await this.getOrderForOffer(orderId);
      if (!order || !this.isDispatchable(order)) return;
      if (round === EXHAUSTION_CHECK_ROUND) {
        await this.finalizeIfUnclaimed(order);
        return;
      }
      if (order.dispatch_round >= round) {
        return; // already dispatched (or beyond) this round
      }

      const pickup = order.business_location?.address;
      const pickupLat = pickup?.latitude ? Number(pickup.latitude) : null;
      const pickupLon = pickup?.longitude ? Number(pickup.longitude) : null;
      if (pickupLat == null || pickupLon == null) {
        this.logger.warn(
          `Order ${orderId} has no pickup coordinates; skipping offer dispatch`
        );
        return;
      }

      const maxDistanceKm =
        round === 1 ? this.round1RadiusKm : this.round2RadiusKm;
      const candidates = await this.findClosestEligibleAgents(
        order,
        pickupLat,
        pickupLon,
        maxDistanceKm
      );

      await this.markRoundDispatched(orderId, round);

      if (candidates.length === 0) {
        this.logger.log(
          `No eligible agents within ${maxDistanceKm}km for order ${orderId} round ${round}`
        );
        await this.scheduleNextStep(orderId, round);
        return;
      }

      const earnings = await this.estimateEarnings(orderId, order.currency);
      const expiresAt = new Date(
        Date.now() + this.ttlSeconds * 1000
      ).toISOString();

      await this.insertOffers(order, candidates, earnings, expiresAt);
      await this.sendOfferPushes(order, candidates, earnings, expiresAt);
      await this.scheduleNextStep(orderId, round);

      this.logger.log(
        `Dispatched round ${round} (${candidates.length} offer(s), <=${maxDistanceKm}km) for order ${order.order_number}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to run dispatch round ${round} for ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private isDispatchable(order: OfferOrderDetails): boolean {
    return (
      order.current_status === 'ready_for_pickup' &&
      !order.assigned_agent_id &&
      order.fulfillment_method === 'delivery'
    );
  }

  private isDispatchGateOpen(order: OfferOrderDetails): boolean {
    if (!order.dispatch_ready_at) return true;
    return new Date(order.dispatch_ready_at).getTime() <= Date.now();
  }

  /** After round 1 -> schedule round 2. After round 2 -> schedule the exhaustion check. */
  private async scheduleNextStep(
    orderId: string,
    completedRound: number
  ): Promise<void> {
    const nextRound =
      completedRound === 1 ? 2 : EXHAUSTION_CHECK_ROUND;
    await this.waitAndExecuteScheduleService.scheduleDispatchRound(
      orderId,
      nextRound,
      this.roundGapSeconds
    );
  }

  private async markRoundDispatched(
    orderId: string,
    round: number
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation MarkDispatchRound($id: uuid!, $round: smallint!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: { dispatch_round: $round, updated_at: "now()" }
        ) { id }
      }`,
      { id: orderId, round }
    );
  }

  /**
   * Called after both dispatch rounds have run. If the order is still
   * unclaimed, mark it exhausted and notify the client with the cancel /
   * switch-to-pickup fallback.
   */
  private async finalizeIfUnclaimed(order: OfferOrderDetails): Promise<void> {
    if (order.dispatch_round < 2) {
      // Round 2 never ran (e.g. round 1 found agents but they let the offer
      // expire without a claim happening via this service); nothing to do
      // beyond what round 2 scheduling already covers.
      return;
    }
    await this.markDispatchExhausted(order);
  }

  private async markDispatchExhausted(order: OfferOrderDetails): Promise<void> {
    const exhaustedAt = new Date().toISOString();
    // Guard on dispatch_exhausted_at still being null so duplicate exhaustion
    // callbacks (SFN retries, re-POSTs to the internal endpoint) can't send
    // the client a second "no agent found" push/message for the same order.
    const result = await this.hasuraSystemService
      .executeMutation<{
        update_orders: { affected_rows: number } | null;
      }>(
        `mutation MarkDispatchExhausted($id: uuid!, $at: timestamptz!) {
          update_orders(
            where: { id: { _eq: $id }, dispatch_exhausted_at: { _is_null: true } }
            _set: { dispatch_exhausted_at: $at, updated_at: "now()" }
          ) { affected_rows }
        }`,
        { id: order.id, at: exhaustedAt }
      )
      .catch(() => null);
    if (!result?.update_orders?.affected_rows) return;
    this.logger.warn(
      `Dispatch exhausted for order ${order.order_number}; notifying client`
    );
    await this.notifyClientNoAgentFound(order).catch((error) =>
      this.logger.warn(
        `notifyClientNoAgentFound failed for ${order.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
  }

  private async notifyClientNoAgentFound(
    order: OfferOrderDetails
  ): Promise<void> {
    const client = await this.getClientForNoAgentNotice(order.id);
    if (!client?.userId) return;
    const canSwitchToPickup = await this.businessSupportsPickup(order);
    await this.insertNoAgentUserMessage(order, client.userId, canSwitchToPickup);
    await this.notificationsService.sendOrderNoAgentPush({
      clientUserId: client.userId,
      orderId: order.id,
      orderNumber: order.order_number,
      preferredLanguage: client.preferredLanguage,
      canSwitchToPickup,
    });
  }

  private async insertNoAgentUserMessage(
    order: OfferOrderDetails,
    clientUserId: string,
    canSwitchToPickup: boolean
  ): Promise<void> {
    const message = JSON.stringify({
      i18nKey: 'orders.noAgentFound.message',
      params: { orderNumber: order.order_number },
    });
    await this.hasuraSystemService.executeMutation(
      `mutation InsertNoAgentMessage(
        $userId: uuid!
        $entityId: uuid!
        $message: String!
        $payload: jsonb!
      ) {
        insert_user_messages_one(object: {
          user_id: $userId
          entity_type: order
          entity_id: $entityId
          message: $message
          message_type: DELIVERY_NO_AGENT
          message_payload: $payload
          is_immutable: true
        }) { id }
      }`,
      {
        userId: clientUserId,
        entityId: order.id,
        message,
        payload: {
          orderId: order.id,
          orderNumber: order.order_number,
          canSwitchToPickup,
        },
      }
    );
  }

  private async getClientForNoAgentNotice(orderId: string): Promise<{
    userId: string | null;
    preferredLanguage: string | null;
  } | null> {
    const query = `
      query ClientForNoAgent($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          client {
            user_id
            user { preferred_language }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      orders_by_pk: {
        client?: {
          user_id?: string | null;
          user?: { preferred_language?: string | null } | null;
        } | null;
      } | null;
    }>(query, { orderId });
    const client = result?.orders_by_pk?.client;
    if (!client) return null;
    return {
      userId: client.user_id ?? null,
      preferredLanguage: client.user?.preferred_language ?? null,
    };
  }

  private async businessSupportsPickup(
    order: OfferOrderDetails
  ): Promise<boolean> {
    const query = `
      query OrderItemsPickupEligibility($orderId: uuid!) {
        order_items(where: { order_id: { _eq: $orderId } }) {
          business_inventory {
            item { pay_at_pickup_enabled }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      order_items: Array<{
        business_inventory?: {
          item?: { pay_at_pickup_enabled?: boolean | null } | null;
        } | null;
      }>;
    }>(query, { orderId: order.id });
    const items = result?.order_items ?? [];
    if (items.length === 0) return false;
    return items.every(
      (oi) => oi.business_inventory?.item?.pay_at_pickup_enabled === true
    );
  }

  /**
   * After an order is assigned to an agent (via offer accept or normal claim),
   * mark the winner's offer accepted, cancel the remaining offers, and push a
   * dismissal to the other agents so their offer screens close.
   */
  async handleOrderAssigned(
    orderId: string,
    winnerAgentId: string
  ): Promise<void> {
    try {
      await this.markWinnerOffer(orderId, winnerAgentId);
      const losers = await this.cancelSiblingOffers(orderId, winnerAgentId);
      await Promise.all(
        losers.map((row) =>
          this.notificationsService
            .sendOrderOfferCancelledPush({
              userId: row.user_id,
              title: 'Delivery already taken',
              body: 'Another courier accepted this delivery first.',
              orderId,
            })
            .catch(() => undefined)
        )
      );
    } catch (error) {
      this.logger.warn(
        `Failed to finalize offers for assigned order ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Returns the caller's active (offered, non-expired) offer for an order, or
   * null. Used to gate the accept endpoint.
   */
  async getActiveOfferForAgent(
    orderId: string,
    agentId: string
  ): Promise<{ id: string; expires_at: string } | null> {
    const query = `
      query ActiveOffer($orderId: uuid!, $agentId: uuid!, $now: timestamptz!) {
        order_offers(
          where: {
            _and: [
              { order_id: { _eq: $orderId } }
              { agent_id: { _eq: $agentId } }
              { status: { _eq: "offered" } }
              { expires_at: { _gt: $now } }
            ]
          }
          limit: 1
        ) {
          id
          expires_at
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
      agentId,
      now: new Date().toISOString(),
    });
    return result?.order_offers?.[0] ?? null;
  }

  /**
   * Build the full offer payload the mobile offer screen renders. Re-validates
   * that the offer is still live (offered, not expired, order still claimable).
   */
  async getOfferDetailsForAgent(
    orderId: string,
    agentId: string
  ): Promise<OfferDetailsResponse> {
    const query = `
      query OfferDetails($orderId: uuid!, $agentId: uuid!) {
        order_offers(
          where: {
            _and: [
              { order_id: { _eq: $orderId } }
              { agent_id: { _eq: $agentId } }
            ]
          }
          limit: 1
        ) {
          status
          distance_km
          estimated_earnings
          currency
          expires_at
          order {
            id
            order_number
            current_status
            assigned_agent_id
            business {
              name
            }
            business_location {
              name
              address {
                address_line_1
                city
                state
                latitude
                longitude
              }
            }
            delivery_address {
              city
              state
              latitude
              longitude
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
      agentId,
    });
    return this.mapOfferRow(result?.order_offers?.[0]);
  }

  /**
   * Returns the caller's most recent active offer (across all orders) so the
   * app can surface a pending offer on open, regardless of active persona.
   */
  async getPendingOfferForAgent(agentId: string): Promise<OfferDetailsResponse> {
    const query = `
      query PendingOffer($agentId: uuid!, $now: timestamptz!) {
        order_offers(
          where: {
            _and: [
              { agent_id: { _eq: $agentId } }
              { status: { _eq: "offered" } }
              { expires_at: { _gt: $now } }
              { order: { current_status: { _eq: "ready_for_pickup" } } }
              { order: { assigned_agent_id: { _is_null: true } } }
            ]
          }
          order_by: { created_at: desc }
          limit: 1
        ) {
          status
          distance_km
          estimated_earnings
          currency
          expires_at
          order {
            id
            order_number
            current_status
            assigned_agent_id
            business {
              name
            }
            business_location {
              name
              address {
                address_line_1
                city
                state
                latitude
                longitude
              }
            }
            delivery_address {
              city
              state
              latitude
              longitude
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      agentId,
      now: new Date().toISOString(),
    });
    return this.mapOfferRow(result?.order_offers?.[0]);
  }

  /** Map a raw order_offers row (with joined order) to the offer payload. */
  private mapOfferRow(row: OfferRow | undefined): OfferDetailsResponse {
    if (!row || !row.order) {
      return { success: true, active: false, offer: null };
    }

    const order = row.order;
    const expired = new Date(row.expires_at).getTime() <= Date.now();
    const active =
      row.status === 'offered' &&
      !expired &&
      order.current_status === 'ready_for_pickup' &&
      !order.assigned_agent_id;

    const pickupAddr = order.business_location?.address;
    const dropoffAddr = order.delivery_address;
    const estimatedDeliveryMinutes = this.estimateDeliveryMinutes(
      pickupAddr,
      dropoffAddr
    );

    return {
      success: true,
      active,
      offer: {
        orderId: order.id,
        orderNumber: order.order_number,
        expiresAt: row.expires_at,
        distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
        estimatedEarnings:
          row.estimated_earnings != null
            ? Number(row.estimated_earnings)
            : null,
        currency: row.currency ?? null,
        estimatedDeliveryMinutes,
        pickup: {
          businessName:
            order.business_location?.name || order.business?.name || null,
          city: pickupAddr?.city ?? null,
          state: pickupAddr?.state ?? null,
        },
        dropoff: {
          city: dropoffAddr?.city ?? null,
          state: dropoffAddr?.state ?? null,
        },
      },
    };
  }

  private estimateDeliveryMinutes(
    pickupAddr: OfferAddress | null | undefined,
    dropoffAddr: OfferAddress | null | undefined
  ): number | null {
    const pLat = pickupAddr?.latitude ? Number(pickupAddr.latitude) : null;
    const pLon = pickupAddr?.longitude ? Number(pickupAddr.longitude) : null;
    const dLat = dropoffAddr?.latitude ? Number(dropoffAddr.latitude) : null;
    const dLon = dropoffAddr?.longitude ? Number(dropoffAddr.longitude) : null;
    if (pLat == null || pLon == null || dLat == null || dLon == null) {
      return null;
    }
    const distanceKm = haversineDistanceKm(pLat, pLon, dLat, dLon);
    // Assume ~25 km/h average in-city speed plus a 10 minute handling buffer.
    return Math.round((distanceKm / 25) * 60) + 10;
  }

  /**
   * Mark the caller's offer as declined.
   */
  async declineOffer(orderId: string, agentId: string): Promise<void> {
    const mutation = `
      mutation DeclineOffer($orderId: uuid!, $agentId: uuid!) {
        update_order_offers(
          where: {
            _and: [
              { order_id: { _eq: $orderId } }
              { agent_id: { _eq: $agentId } }
              { status: { _eq: "offered" } }
            ]
          }
          _set: { status: "declined", responded_at: "now()" }
        ) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      agentId,
    });
  }

  /**
   * Mark the caller's offer as expired (e.g. when they tried to accept but the
   * order was already taken).
   */
  async markOfferExpired(orderId: string, agentId: string): Promise<void> {
    const mutation = `
      mutation ExpireOffer($orderId: uuid!, $agentId: uuid!) {
        update_order_offers(
          where: {
            _and: [
              { order_id: { _eq: $orderId } }
              { agent_id: { _eq: $agentId } }
              { status: { _eq: "offered" } }
            ]
          }
          _set: { status: "expired", responded_at: "now()" }
        ) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      agentId,
    });
  }

  private async getOrderForOffer(
    orderId: string
  ): Promise<OfferOrderDetails | null> {
    const query = `
      query OfferOrder($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          assigned_agent_id
          fulfillment_method
          currency
          verified_agent_delivery
          dispatch_ready_at
          dispatch_round
          business {
            name
          }
          business_location {
            name
            address {
              country
              state
              latitude
              longitude
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });
    return result?.orders_by_pk ?? null;
  }

  private async findClosestEligibleAgents(
    order: OfferOrderDetails,
    pickupLat: number,
    pickupLon: number,
    maxDistanceKm: number
  ): Promise<CandidateAgent[]> {
    const businessCountry = order.business_location?.address?.country;
    const businessState = order.business_location?.address?.state;

    const candidates = await this.eligibleAgentsQueryService.findEligibleAgents(
      {
        originLat: pickupLat,
        originLon: pickupLon,
        targetCountry: businessCountry ?? '',
        targetState: businessState ?? '',
        internalOnly: order.verified_agent_delivery,
        maxDistanceKm,
      }
    );

    const eligible: CandidateAgent[] = candidates
      .filter((c) => c.userId != null)
      .map((c) => ({
        agentId: c.agentId,
        userId: c.userId as string,
        distanceKm: c.distanceKm,
      }));

    const withPushToken = await this.filterAgentsWithPushToken(eligible);
    const ranked = await this.rankByPickupReliability(withPushToken);
    return ranked.slice(0, this.maxAgents);
  }

  /** Prefer closer agents; among similar distance, prefer higher pickup reliability. */
  private async rankByPickupReliability(
    candidates: CandidateAgent[]
  ): Promise<CandidateAgent[]> {
    if (candidates.length === 0) return [];
    const res = await this.hasuraSystemService.executeQuery(
      `query AgentPickupRel($ids: [uuid!]!) {
        agents(where: { id: { _in: $ids } }) {
          id pickup_reliability_score
        }
      }`,
      { ids: candidates.map((c) => c.agentId) }
    );
    const scoreById = new Map<string, number>(
      ((res.agents || []) as Array<{ id: string; pickup_reliability_score?: number }>).map(
        (a) => [a.id, Number(a.pickup_reliability_score ?? 100)]
      )
    );
    const eligible = candidates.filter(
      (c) => (scoreById.get(c.agentId) ?? 100) >= 40
    );
    const pool = eligible.length > 0 ? eligible : candidates;
    return pool.sort((a, b) => {
      const distDiff = a.distanceKm - b.distanceKm;
      if (Math.abs(distDiff) > 0.5) return distDiff;
      return (
        (scoreById.get(b.agentId) ?? 100) - (scoreById.get(a.agentId) ?? 100)
      );
    });
  }

  private async filterAgentsWithPushToken(
    candidates: CandidateAgent[]
  ): Promise<CandidateAgent[]> {
    if (candidates.length === 0) return [];
    const userIds = candidates.map((c) => c.userId);
    const query = `
      query PushTokens($userIds: [uuid!]!) {
        mobile_push_tokens(where: { user_id: { _in: $userIds } }) {
          user_id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userIds,
    });
    const rows = (result?.mobile_push_tokens as Array<{ user_id: string }>) ?? [];
    const usersWithToken = new Set(rows.map((r) => r.user_id));
    return candidates.filter((c) => usersWithToken.has(c.userId));
  }

  private async estimateEarnings(
    orderId: string,
    fallbackCurrency: string
  ): Promise<{ amount: number | null; currency: string }> {
    try {
      const earnings = await this.commissionsService.calculateAgentEarnings(
        orderId,
        true
      );
      return {
        amount: earnings.totalEarnings,
        currency: earnings.currency ?? fallbackCurrency,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to estimate earnings for order ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { amount: null, currency: fallbackCurrency };
    }
  }

  private async insertOffers(
    order: OfferOrderDetails,
    candidates: CandidateAgent[],
    earnings: { amount: number | null; currency: string },
    expiresAt: string
  ): Promise<void> {
    const objects = candidates.map((c) => ({
      order_id: order.id,
      agent_id: c.agentId,
      user_id: c.userId,
      status: 'offered',
      distance_km: Number(c.distanceKm.toFixed(3)),
      estimated_earnings: earnings.amount,
      currency: earnings.currency,
      expires_at: expiresAt,
    }));
    const mutation = `
      mutation UpsertOffers($objects: [order_offers_insert_input!]!) {
        insert_order_offers(
          objects: $objects
          on_conflict: {
            constraint: order_offers_order_agent_unique
            update_columns: [
              status
              distance_km
              estimated_earnings
              currency
              expires_at
              responded_at
            ]
          }
        ) {
          affected_rows
        }
      }
    `;
    const objectsWithResetResponse = objects.map((o) => ({
      ...o,
      responded_at: null,
    }));
    await this.hasuraSystemService.executeMutation(mutation, {
      objects: objectsWithResetResponse,
    });
  }

  private async sendOfferPushes(
    order: OfferOrderDetails,
    candidates: CandidateAgent[],
    earnings: { amount: number | null; currency: string },
    expiresAt: string
  ): Promise<void> {
    const businessName =
      order.business_location?.name || order.business?.name || 'a store';
    await Promise.all(
      candidates.map((c) => {
        const distance = c.distanceKm.toFixed(1);
        const earningsText =
          earnings.amount != null
            ? ` - Est. ${Math.round(earnings.amount)} ${earnings.currency}`
            : '';
        return this.notificationsService
          .sendOrderOfferPush({
            userId: c.userId,
            title: 'New delivery available',
            body: `Pickup: ${businessName} (${distance} km away)${earningsText} - Only claim if you can head there now to pick up - Tap to respond`,
            orderId: order.id,
            expiresAt,
            ttlSeconds: this.ttlSeconds,
          })
          .catch(() => undefined);
      })
    );
  }

  /**
   * Cancel all outstanding offers for an order (e.g. when the client switches
   * to pickup or cancels while dispatch is exhausted).
   */
  async cancelAllOffers(orderId: string): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation CancelAllOffers($orderId: uuid!) {
        update_order_offers(
          where: { order_id: { _eq: $orderId }, status: { _eq: "offered" } }
          _set: { status: "cancelled", responded_at: "now()" }
        ) { affected_rows }
      }`,
      { orderId }
    );
  }

  private async markWinnerOffer(
    orderId: string,
    winnerAgentId: string
  ): Promise<void> {
    const mutation = `
      mutation AcceptOffer($orderId: uuid!, $agentId: uuid!) {
        update_order_offers(
          where: {
            _and: [
              { order_id: { _eq: $orderId } }
              { agent_id: { _eq: $agentId } }
              { status: { _eq: "offered" } }
            ]
          }
          _set: { status: "accepted", responded_at: "now()" }
        ) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      agentId: winnerAgentId,
    });
  }

  private async cancelSiblingOffers(
    orderId: string,
    winnerAgentId: string
  ): Promise<Array<{ user_id: string }>> {
    const mutation = `
      mutation CancelSiblingOffers($orderId: uuid!, $agentId: uuid!) {
        update_order_offers(
          where: {
            _and: [
              { order_id: { _eq: $orderId } }
              { agent_id: { _neq: $agentId } }
              { status: { _eq: "offered" } }
            ]
          }
          _set: { status: "cancelled", responded_at: "now()" }
        ) {
          returning {
            user_id
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      agentId: winnerAgentId,
    });
    return result?.update_order_offers?.returning ?? [];
  }

}
