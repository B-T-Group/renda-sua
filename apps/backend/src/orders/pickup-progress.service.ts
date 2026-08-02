import { Injectable, Logger } from '@nestjs/common';
import { haversineDistanceKm } from '../common/agent-proximity.util';
import { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { OrderEventsService } from './order-events.service';
import type {
  MonitoredPickupOrder,
  PickupMonitorConfig,
  PickupProgressResult,
} from './order-pickup.types';

@Injectable()
export class PickupProgressService {
  private readonly logger = new Logger(PickupProgressService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly googleDistance: GoogleDistanceService,
    private readonly orderEvents: OrderEventsService
  ) {}

  async evaluate(
    order: MonitoredPickupOrder,
    config: PickupMonitorConfig,
    options?: { includeEta?: boolean; remainingGraceMinutes?: number }
  ): Promise<PickupProgressResult> {
    if (order.agent_arrived_pickup_at) {
      return this.arrivedResult(order.last_agent_distance_m);
    }
    const pickup = this.getPickupCoords(order);
    if (!pickup || !order.assigned_agent_id) {
      return this.unknownResult(order.last_agent_distance_m);
    }
    const location = await this.fetchAgentLocation(order.assigned_agent_id);
    if (!location || this.isStale(location.updated_at, config.gpsStaleMinutes)) {
      await this.logGpsUnavailable(order);
      return this.unknownResult(order.last_agent_distance_m);
    }
    return this.buildProgress(order, pickup, location, config, options);
  }

  private async buildProgress(
    order: MonitoredPickupOrder,
    pickup: { lat: number; lng: number },
    location: { latitude: number; longitude: number; updated_at: string },
    config: PickupMonitorConfig,
    options?: { includeEta?: boolean; remainingGraceMinutes?: number }
  ): Promise<PickupProgressResult> {
    const distanceMeters =
      haversineDistanceKm(
        location.latitude,
        location.longitude,
        pickup.lat,
        pickup.lng
      ) * 1000;
    const previous = order.last_agent_distance_m;
    const isArrived = distanceMeters <= config.geofenceMeters;
    const isApproaching = this.isApproaching(
      distanceMeters,
      previous,
      config.approachDeltaMeters
    );
    if (isArrived && !order.agent_arrived_pickup_at) {
      await this.markArrived(order.id, distanceMeters);
    }
    await this.persistDistance(order.id, distanceMeters);
    const etaMinutes = options?.includeEta
      ? await this.fetchEtaMinutes(location, pickup)
      : null;
    const shouldDefer =
      isArrived ||
      isApproaching ||
      (etaMinutes != null &&
        options?.remainingGraceMinutes != null &&
        etaMinutes <= options.remainingGraceMinutes);
    return {
      distanceMeters,
      previousDistanceMeters: previous,
      isApproaching,
      isArrived,
      gpsUnavailable: false,
      etaMinutes,
      shouldDeferEscalation: shouldDefer,
    };
  }

  private isApproaching(
    current: number,
    previous: number | null | undefined,
    deltaMeters: number
  ): boolean {
    if (previous == null || previous <= 0) return false;
    const shrink = previous - current;
    return shrink >= deltaMeters || shrink >= previous * 0.1;
  }

  private getPickupCoords(
    order: MonitoredPickupOrder
  ): { lat: number; lng: number } | null {
    const lat = order.business_location?.address?.latitude;
    const lng = order.business_location?.address?.longitude;
    if (lat == null || lng == null) return null;
    return { lat: Number(lat), lng: Number(lng) };
  }

  private async fetchAgentLocation(agentId: string): Promise<{
    latitude: number;
    longitude: number;
    updated_at: string;
  } | null> {
    const res = await this.hasura.executeQuery(
      `query AgentLoc($agentId: uuid!) {
        agent_locations(where: { agent_id: { _eq: $agentId } }, limit: 1) {
          latitude longitude updated_at
        }
      }`,
      { agentId }
    );
    const row = res.agent_locations?.[0];
    if (!row) return null;
    return {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      updated_at: row.updated_at,
    };
  }

  private isStale(updatedAt: string, staleMinutes: number): boolean {
    const ageMs = Date.now() - new Date(updatedAt).getTime();
    return ageMs > staleMinutes * 60 * 1000;
  }

  private async fetchEtaMinutes(
    from: { latitude: number; longitude: number },
    to: { lat: number; lng: number }
  ): Promise<number | null> {
    try {
      const origin = `${from.latitude},${from.longitude}`;
      const dest = `${to.lat},${to.lng}`;
      const matrix = await this.googleDistance.getDistanceMatrix(
        [origin],
        [dest]
      );
      const seconds = matrix?.rows?.[0]?.elements?.[0]?.duration?.value;
      if (seconds == null || !Number.isFinite(seconds)) return null;
      return Math.ceil(seconds / 60);
    } catch (error: any) {
      this.logger.warn(`ETA fetch failed: ${error?.message}`);
      return null;
    }
  }

  private async markArrived(
    orderId: string,
    distanceMeters: number
  ): Promise<void> {
    const at = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation MarkArrived($id: uuid!, $dist: numeric!, $at: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            agent_arrived_pickup_at: $at
            last_agent_distance_m: $dist
            last_agent_progress_at: $at
            pickup_state: recovered
          }
        ) { id }
      }`,
      { id: orderId, dist: distanceMeters, at }
    );
    await this.orderEvents.recordEvent({
      orderId,
      eventType: 'agent_arrived_pickup',
      actorType: 'system',
      payload: { distanceMeters },
    });
  }

  private async persistDistance(
    orderId: string,
    distanceMeters: number
  ): Promise<void> {
    await this.hasura.executeMutation(
      `mutation PersistDist($id: uuid!, $dist: numeric!, $at: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $id }
          _set: {
            last_agent_distance_m: $dist
            last_agent_progress_at: $at
          }
        ) { id }
      }`,
      {
        id: orderId,
        dist: distanceMeters,
        at: new Date().toISOString(),
      }
    );
  }

  private async logGpsUnavailable(order: MonitoredPickupOrder): Promise<void> {
    const recent = await this.hasRecentGpsUnavailable(order.id);
    if (recent) return;
    await this.orderEvents.recordEvent({
      orderId: order.id,
      eventType: 'gps_unavailable',
      actorType: 'system',
      payload: { agentId: order.assigned_agent_id },
    });
  }

  private async hasRecentGpsUnavailable(orderId: string): Promise<boolean> {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const res = await this.hasura.executeQuery(
      `query RecentGpsUnavailable($orderId: uuid!, $since: timestamptz!) {
        order_events_aggregate(
          where: {
            order_id: { _eq: $orderId }
            event_type: { _eq: "gps_unavailable" }
            created_at: { _gte: $since }
          }
        ) { aggregate { count } }
      }`,
      { orderId, since }
    );
    return (res.order_events_aggregate?.aggregate?.count ?? 0) > 0;
  }

  private arrivedResult(previous: number | null): PickupProgressResult {
    return {
      distanceMeters: previous,
      previousDistanceMeters: previous,
      isApproaching: false,
      isArrived: true,
      gpsUnavailable: false,
      etaMinutes: 0,
      shouldDeferEscalation: true,
    };
  }

  private unknownResult(previous: number | null): PickupProgressResult {
    return {
      distanceMeters: previous,
      previousDistanceMeters: previous,
      isApproaching: false,
      isArrived: false,
      gpsUnavailable: true,
      etaMinutes: null,
      shouldDeferEscalation: false,
    };
  }
}
