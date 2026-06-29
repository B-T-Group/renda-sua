import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommissionsService } from '../commissions/commissions.service';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';

interface OfferOrderDetails {
  id: string;
  order_number: string;
  current_status: string;
  assigned_agent_id: string | null;
  fulfillment_method: string | null;
  currency: string;
  verified_agent_delivery: boolean;
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

interface EligibleAgentRow {
  latitude: number | string;
  longitude: number | string;
  agent: {
    id: string;
    is_available: boolean;
    is_verified: boolean;
    is_internal: boolean;
    status: string;
    user: { id: string } | null;
    agent_addresses: Array<{
      address: {
        country?: string | null;
        state?: string | null;
        is_primary?: boolean | null;
      } | null;
    }>;
  } | null;
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
    private readonly configService: ConfigService<Configuration>
  ) {}

  private get ttlSeconds(): number {
    return this.configService.get('orderOffers')?.ttlSeconds ?? 30;
  }

  private get maxAgents(): number {
    return this.configService.get('orderOffers')?.maxAgents ?? 5;
  }

  /**
   * Fan out a one-round delivery offer to the closest eligible agents when an
   * order becomes claimable. Idempotent: skips if offers already exist for the
   * order. Errors are logged and swallowed so the caller (notification path)
   * is never blocked.
   */
  async dispatchOrderOffers(orderId: string): Promise<void> {
    try {
      if (await this.hasExistingOffers(orderId)) {
        return;
      }

      const order = await this.getOrderForOffer(orderId);
      if (!order) return;

      if (
        order.current_status !== 'ready_for_pickup' ||
        order.assigned_agent_id ||
        order.fulfillment_method === 'pickup'
      ) {
        return;
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

      const candidates = await this.findClosestEligibleAgents(
        order,
        pickupLat,
        pickupLon
      );
      if (candidates.length === 0) {
        this.logger.log(`No eligible agents for order offer ${orderId}`);
        return;
      }

      const earnings = await this.estimateEarnings(orderId, order.currency);
      const expiresAt = new Date(
        Date.now() + this.ttlSeconds * 1000
      ).toISOString();

      await this.insertOffers(order, candidates, earnings, expiresAt);
      await this.sendOfferPushes(order, candidates, earnings, expiresAt);

      this.logger.log(
        `Dispatched ${candidates.length} offer(s) for order ${order.order_number}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to dispatch order offers for ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
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
    const distanceKm = this.calculateDistance(pLat, pLon, dLat, dLon);
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

  private async hasExistingOffers(orderId: string): Promise<boolean> {
    const query = `
      query ExistingOffers($orderId: uuid!) {
        order_offers(where: { order_id: { _eq: $orderId } }, limit: 1) {
          id
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });
    return (result?.order_offers?.length ?? 0) > 0;
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
    pickupLon: number
  ): Promise<CandidateAgent[]> {
    const businessCountry = order.business_location?.address?.country;
    const businessState = order.business_location?.address?.state;

    const query = `
      query EligibleAgents {
        agent_locations {
          latitude
          longitude
          agent {
            id
            is_available
            is_verified
            is_internal
            status
            user {
              id
            }
            agent_addresses(where: { address: { status: { _eq: active } } }) {
              address {
                country
                state
                is_primary
              }
            }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {});
    const rows = (result?.agent_locations as EligibleAgentRow[]) ?? [];

    const eligible: CandidateAgent[] = [];
    for (const row of rows) {
      const agent = row.agent;
      if (!agent || !agent.user?.id) continue;
      if (!agent.is_available || !agent.is_verified) continue;
      if (agent.status === 'suspended') continue;
      if (order.verified_agent_delivery && !agent.is_internal) continue;

      if (!this.agentMatchesRegion(agent, businessCountry, businessState)) {
        continue;
      }

      const distanceKm = this.calculateDistance(
        pickupLat,
        pickupLon,
        Number(row.latitude),
        Number(row.longitude)
      );
      eligible.push({
        agentId: agent.id,
        userId: agent.user.id,
        distanceKm,
      });
    }

    const withPushToken = await this.filterAgentsWithPushToken(eligible);
    withPushToken.sort((a, b) => a.distanceKm - b.distanceKm);
    return withPushToken.slice(0, this.maxAgents);
  }

  private agentMatchesRegion(
    agent: NonNullable<EligibleAgentRow['agent']>,
    businessCountry?: string | null,
    businessState?: string | null
  ): boolean {
    const addresses = agent.agent_addresses ?? [];
    if (addresses.length === 0) return false;
    const primary =
      addresses.find((a) => a.address?.is_primary) ?? addresses[0];
    const country = primary.address?.country;
    const state = primary.address?.state;
    return country === businessCountry && state === businessState;
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
      mutation InsertOffers($objects: [order_offers_insert_input!]!) {
        insert_order_offers(objects: $objects) {
          affected_rows
        }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, { objects });
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
            body: `Pickup: ${businessName} (${distance} km away)${earningsText} - Tap to respond`,
            orderId: order.id,
            expiresAt,
            ttlSeconds: this.ttlSeconds,
          })
          .catch(() => undefined);
      })
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

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  /** Haversine distance in kilometers. */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
