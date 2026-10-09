import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DistributedLockService } from '../common/distributed-lock.service';
import { GoogleDistanceService } from '../google/google-distance.service';
import type { GeocodingResult } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { getActivePersonaOrThrow } from '../users/persona.util';
import type { AddressResponse } from './addresses.service';
import { AddressesService } from './addresses.service';
import { haversineMeters } from './haversine';

const REUSE_WITHIN_METERS = 75;
/** New current-location addresses a user may create per rolling 24 h (reuse is free). */
export const DAILY_CREATE_CAP = 30;
/** ~11 m: stable geocode cache key despite GPS jitter. */
const GEOCODE_KEY_DECIMALS = 4;
const LOCK_TTL_MS = 20_000;
const LOCK_WAIT_MS = 15_000;
const SAFE_UNRESOLVED = 'Could not resolve the current location';

const CREATED_TODAY = `
  query CurrentLocationCreatedSince($userId: uuid!, $since: timestamptz!, $cap: Int!) {
    client_addresses(
      where: {
        client: { user_id: { _eq: $userId } }
        address: {
          address_type: { _eq: "current_location" }
          created_at: { _gte: $since }
        }
      }
      limit: $cap
    ) {
      id
    }
  }
`;

const CLIENT_ADDRESSES_WITH_COORDS = `
  query ClientAddressesWithCoords {
    client_addresses(
      where: {
        address: {
          status: { _eq: active }
          latitude: { _is_null: false }
          longitude: { _is_null: false }
        }
      }
    ) {
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
        is_primary
        address_type
        latitude
        longitude
        instructions
        created_at
        updated_at
        status
      }
    }
  }
`;

interface ClientAddressRow {
  address: AddressResponse;
}

export interface CurrentLocationResult {
  address: AddressResponse;
  reused: boolean;
}

@Injectable()
export class CurrentLocationAddressService {
  private readonly logger = new Logger(CurrentLocationAddressService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly googleDistanceService: GoogleDistanceService,
    private readonly addressesService: AddressesService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly locks: DistributedLockService
  ) {}

  async resolve(
    latitude: number,
    longitude: number
  ): Promise<CurrentLocationResult> {
    this.assertCoordinates(latitude, longitude);
    const user = await this.hasuraUserService.getUser();
    if (getActivePersonaOrThrow(user) !== 'client') {
      throw new HttpException(
        { success: false, error: 'Only clients can use the current location' },
        HttpStatus.FORBIDDEN
      );
    }
    // Serialise per user: parallel identical requests (double tap, two tabs, retries)
    // must find the first request's address instead of each inserting their own.
    const release = await this.locks.acquire(
      `current-location:${user.id}`,
      LOCK_TTL_MS,
      LOCK_WAIT_MS
    );
    if (!release) {
      throw new HttpException(
        { success: false, error: 'Please try again in a moment' },
        HttpStatus.CONFLICT
      );
    }
    try {
      const nearby = await this.findWithin(latitude, longitude);
      if (nearby) return { address: nearby, reused: true };
      await this.assertUnderDailyCap(user.id);
      return await this.createFromGps(latitude, longitude);
    } finally {
      await release();
    }
  }

  private async assertUnderDailyCap(userId: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = await this.hasuraSystemService.executeQuery<{
      client_addresses: { id: string }[];
    }>(CREATED_TODAY, { userId, since, cap: DAILY_CREATE_CAP });
    if ((result.client_addresses ?? []).length < DAILY_CREATE_CAP) return;
    throw new HttpException(
      {
        success: false,
        error: 'Too many locations saved today. Choose a saved address instead.',
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private assertCoordinates(latitude: number, longitude: number): void {
    const latOk = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
    const lngOk = Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
    if (latOk && lngOk) return;
    throw new HttpException(
      { success: false, error: 'latitude and longitude are required' },
      HttpStatus.BAD_REQUEST
    );
  }

  private async findWithin(
    latitude: number,
    longitude: number
  ): Promise<AddressResponse | null> {
    const result = await this.hasuraUserService.executeQuery<{
      client_addresses: ClientAddressRow[];
    }>(CLIENT_ADDRESSES_WITH_COORDS);
    const rows = result.client_addresses ?? [];
    return (
      rows
        .map((row) => row.address)
        .find((address) => this.isNearby(address, latitude, longitude)) ?? null
    );
  }

  private isNearby(
    address: AddressResponse,
    latitude: number,
    longitude: number
  ): boolean {
    const lat = Number(address.latitude);
    const lng = Number(address.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return haversineMeters(latitude, longitude, lat, lng) <= REUSE_WITHIN_METERS;
  }

  private async createFromGps(
    latitude: number,
    longitude: number
  ): Promise<CurrentLocationResult> {
    const geo = await this.reverse(latitude, longitude);
    const created = await this.addressesService.createAddress({
      address_line_1: this.line1(geo),
      city: geo.city.trim(),
      state: geo.state?.trim() || geo.city.trim(),
      postal_code: geo.postal_code || undefined,
      country: geo.country_code || geo.country,
      address_type: 'current_location',
      is_primary: false,
      latitude,
      longitude,
    });
    return { address: created.address, reused: false };
  }

  /**
   * Fee pricing and dispatch use the address *text*, so never save placeholders
   * ("Unknown" city, "Current location" street): reject and let the user add an address.
   */
  private async reverse(latitude: number, longitude: number): Promise<GeocodingResult> {
    const geo = await this.lookup(latitude, longitude);
    const hasCountry = Boolean(geo.country_code || geo.country);
    if (hasCountry && geo.city?.trim() && this.line1(geo)) return geo;
    throw this.unresolved();
  }

  private async lookup(latitude: number, longitude: number): Promise<GeocodingResult> {
    try {
      // Rounded for a stable geocode cache key; the saved address keeps the exact point.
      return await this.googleDistanceService.reverseGeocode(
        Number(latitude.toFixed(GEOCODE_KEY_DECIMALS)),
        Number(longitude.toFixed(GEOCODE_KEY_DECIMALS))
      );
    } catch (error: any) {
      // Provider text (quota, key state) must never reach the caller: log, fixed message.
      this.logger.warn(`current_location_reverse_geocode_failed: ${error?.message}`);
      throw this.unresolved();
    }
  }

  private unresolved(): HttpException {
    return new HttpException(
      { success: false, error: SAFE_UNRESOLVED },
      HttpStatus.BAD_REQUEST
    );
  }

  private line1(geo: GeocodingResult): string {
    return geo.address_line_1?.trim() || geo.formatted_address?.trim() || '';
  }
}
