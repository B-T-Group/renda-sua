import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EligibleAgentsQueryService } from '../delivery-availability/eligible-agents-query.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { LocationsService } from '../locations/locations.service';
import { resolveActivePersonaWithDefault } from '../users/persona.util';

const MAX_NEARBY_AGENTS = 10;

interface ClientCoords {
  latitude: number;
  longitude: number;
  country: string;
  state: string;
}

interface ClientAddress {
  id?: string | null;
  address_line_1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  is_primary?: boolean | null;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly locationsService: LocationsService,
    private readonly eligibleAgentsQueryService: EligibleAgentsQueryService
  ) {}

  /**
   * Number of available agents in the client's region, capped to the closest
   * `MAX_NEARBY_AGENTS` by Haversine distance from the client's primary address.
   */
  async getNearbyAgentsCount(): Promise<{ count: number }> {
    const coords = await this.resolveClientCoords();
    if (!coords) return { count: 0 };

    const candidates = await this.eligibleAgentsQueryService.findEligibleAgents(
      {
        originLat: coords.latitude,
        originLon: coords.longitude,
        targetCountry: coords.country,
        targetState: coords.state,
      }
    );
    return { count: Math.min(candidates.length, MAX_NEARBY_AGENTS) };
  }

  private async resolveClientCoords(): Promise<ClientCoords | null> {
    const user = await this.hasuraUserService.getUser();
    const active = resolveActivePersonaWithDefault(
      user,
      this.hasuraUserService.getActivePersonaHeader()
    );
    if (active !== 'client') {
      throw new HttpException(
        'Only clients can view nearby agents',
        HttpStatus.FORBIDDEN
      );
    }
    if (!user.client?.id) {
      throw new HttpException(
        'Client profile is missing',
        HttpStatus.FORBIDDEN
      );
    }
    return this.toCoords(user.addresses);
  }

  private async toCoords(
    addresses: ClientAddress[] | undefined
  ): Promise<ClientCoords | null> {
    const list = addresses ?? [];
    const primary = list.find((a) => a?.is_primary) ?? list[0];
    if (!primary?.country || !primary?.state) {
      return null;
    }

    const coords = await this.resolvePrimaryCoordinates(primary);
    if (!coords) {
      return null;
    }

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      country: primary.country,
      state: primary.state,
    };
  }

  /**
   * Returns the primary address coordinates, geocoding and persisting them when
   * they are missing but the full street address is available.
   */
  private async resolvePrimaryCoordinates(
    primary: ClientAddress
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (primary.latitude && primary.longitude) {
      return {
        latitude: Number(primary.latitude),
        longitude: Number(primary.longitude),
      };
    }
    if (!primary.id || !this.hasGeocodableAddress(primary)) {
      return null;
    }
    return this.locationsService.ensureAddressHasCoordinates(
      primary.id,
      primary
    );
  }

  private hasGeocodableAddress(address: ClientAddress): boolean {
    return Boolean(
      address?.address_line_1 &&
        address?.city &&
        address?.state &&
        address?.country &&
        address?.postal_code
    );
  }

}
