import { Injectable, Logger } from '@nestjs/common';
import { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AgentLocation {
  agent_id: string;
  latitude: number;
  longitude: number;
  created_at: string;
  agent: {
    id: string;
    user: {
      email: string;
      first_name: string;
      last_name: string;
    };
  };
}

interface BusinessLocationAddress {
  id: string;
  address_id: string;
  address: {
    id: string;
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    postal_code?: string | null;
    country: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  business: {
    id: string;
    name: string;
  };
}

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly googleDistanceService: GoogleDistanceService,
    private readonly notificationsService: NotificationsService
  ) {}

  /**
   * Convert degrees to radians
   */
  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth radius in km
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

  /**
   * Format address for Google API
   */
  private formatAddressForGoogle(address: any): string {
    return [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ]
      .filter(Boolean)
      .join(', ');
  }

  /**
   * Ensure address has coordinates, geocode if missing
   */
  async ensureAddressHasCoordinates(
    addressId: string,
    address: any
  ): Promise<Coordinates | null> {
    // Check if address already has coordinates
    if (address.latitude && address.longitude) {
      return {
        latitude: parseFloat(address.latitude.toString()),
        longitude: parseFloat(address.longitude.toString()),
      };
    }

    // Geocode the address
    this.logger.log(`Geocoding address ${addressId} - missing coordinates`);
    const addressString = this.formatAddressForGoogle(address);
    const coordinates = await this.googleDistanceService.geocode(addressString);

    if (!coordinates) {
      this.logger.warn(
        `Failed to geocode address ${addressId}: ${addressString}`
      );
      return null;
    }

    // Update address in database with coordinates
    try {
      const updateMutation = `
        mutation UpdateAddressCoordinates($addressId: uuid!, $latitude: numeric!, $longitude: numeric!) {
          update_addresses_by_pk(
            pk_columns: { id: $addressId }
            _set: { latitude: $latitude, longitude: $longitude }
          ) {
            id
            latitude
            longitude
          }
        }
      `;

      await this.hasuraSystemService.executeMutation(updateMutation, {
        addressId,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });

      this.logger.log(
        `Updated address ${addressId} with coordinates: ${coordinates.latitude}, ${coordinates.longitude}`
      );

      return coordinates;
    } catch (error: any) {
      this.logger.error(
        `Failed to update address ${addressId} with coordinates: ${error.message}`
      );
      // Return coordinates anyway since geocoding succeeded
      return coordinates;
    }
  }

  /**
   * Get the latest location for an agent by agent ID.
   * Returns null if no location is stored.
   */
  async getLatestAgentLocation(agentId: string): Promise<{
    agentId: string;
    latitude: number;
    longitude: number;
    updatedAt: string;
  } | null> {
    try {
      const query = `
        query GetLatestAgentLocation($agentId: uuid!) {
          agent_locations(where: { agent_id: { _eq: $agentId } }, limit: 1) {
            agent_id
            latitude
            longitude
            updated_at
            created_at
          }
        }
      `;
      const result = await this.hasuraSystemService.executeQuery(query, {
        agentId,
      });
      const rows = result?.agent_locations ?? [];
      const row = rows[0];
      if (!row) return null;
      return {
        agentId: row.agent_id,
        latitude: parseFloat(row.latitude?.toString() ?? '0'),
        longitude: parseFloat(row.longitude?.toString() ?? '0'),
        updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.warn(
        `Failed to get latest agent location for ${agentId}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Find all agents within specified radius of business location
   */
  async findAgentsWithinRadius(
    businessLat: number,
    businessLon: number,
    radiusKm: number
  ): Promise<AgentLocation[]> {
    try {
      // Get all agent locations (each agent has one location entry)
      const query = `
        query GetAgentLocations {
          agent_locations {
            agent_id
            latitude
            longitude
            created_at
            agent {
              id
              user {
                email
                first_name
                last_name
              }
            }
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query, {});

      if (!result.agent_locations || result.agent_locations.length === 0) {
        this.logger.log('No agent locations found');
        return [];
      }

      const agentsWithinRadius: AgentLocation[] = [];

      for (const agentLocation of result.agent_locations as AgentLocation[]) {
        const distance = this.calculateDistance(
          businessLat,
          businessLon,
          parseFloat(agentLocation.latitude.toString()),
          parseFloat(agentLocation.longitude.toString())
        );

        if (distance <= radiusKm) {
          this.logger.log(
            `Agent ${agentLocation.agent_id} is ${distance.toFixed(
              2
            )}km away (within ${radiusKm}km)`
          );
          agentsWithinRadius.push(agentLocation);
        }
      }

      return agentsWithinRadius;
    } catch (error: any) {
      this.logger.error(
        `Error finding agents within radius: ${error.message}`,
        error.stack
      );
      return [];
    }
  }

  /**
   * Check proximity and notify agents (runs in background)
   */
  async checkProximityAndNotify(
    orderId: string,
    businessLocationId: string
  ): Promise<void> {
    try {
      this.logger.log(
        `Starting proximity check for order ${orderId}, business location ${businessLocationId}`
      );

      // Get business location with address
      const query = `
        query GetBusinessLocation($businessLocationId: uuid!) {
          business_locations_by_pk(id: $businessLocationId) {
            id
            address_id
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
              latitude
              longitude
            }
            business {
              id
              name
            }
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query, {
        businessLocationId,
      });

      const businessLocation =
        result.business_locations_by_pk as BusinessLocationAddress | null;

      if (!businessLocation || !businessLocation.address) {
        this.logger.warn(
          `Business location ${businessLocationId} or address not found`
        );
        return;
      }

      // Ensure address has coordinates
      const coordinates = await this.ensureAddressHasCoordinates(
        businessLocation.address.id,
        businessLocation.address
      );

      if (!coordinates) {
        this.logger.warn(
          `Could not get coordinates for business location ${businessLocationId}`
        );
        return;
      }

      // Find agents within 10km
      const agentsWithinRadius = await this.findAgentsWithinRadius(
        coordinates.latitude,
        coordinates.longitude,
        10 // 10km radius
      );

      if (agentsWithinRadius.length === 0) {
        this.logger.log(
          `No agents found within 10km of business location ${businessLocationId}`
        );
        return;
      }

      this.logger.log(
        `Found ${agentsWithinRadius.length} agent(s) within 10km, sending notifications`
      );

      // Get order details for notification
      const orderQuery = `
        query GetOrderDetails($orderId: uuid!) {
          orders_by_pk(id: $orderId) {
            id
            order_number
            business {
              name
            }
          }
        }
      `;

      const orderResult = await this.hasuraSystemService.executeQuery(
        orderQuery,
        { orderId }
      );

      const order = orderResult.orders_by_pk as any;

      if (!order) {
        this.logger.warn(`Order ${orderId} not found`);
        return;
      }

      // Format business address for notification
      const businessAddress = this.formatAddressForGoogle(
        businessLocation.address
      );

      // Send notifications to all agents within radius
      const notificationPromises = agentsWithinRadius.map((agentLocation) => {
        const agentName =
          `${agentLocation.agent.user.first_name} ${agentLocation.agent.user.last_name}`.trim();
        return this.notificationsService.sendProximityOrderNotification(
          agentLocation.agent.user.email,
          agentName,
          {
            orderId: order.id,
            orderNumber: order.order_number,
            businessName: businessLocation.business.name,
            businessAddress: businessAddress,
          }
        );
      });

      await Promise.all(notificationPromises);

      this.logger.log(
        `Sent proximity notifications to ${agentsWithinRadius.length} agent(s) for order ${order.order_number}`
      );
    } catch (error: any) {
      this.logger.error(
        `Error in proximity check for order ${orderId}: ${error.message}`,
        error.stack
      );
      // Don't throw - this runs in background
    }
  }
}
