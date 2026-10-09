import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { GoogleDistanceService } from '../google/google-distance.service';
import type { GeocodingResult } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { AddressResponse } from './addresses.service';
import { AddressesService } from './addresses.service';
import { haversineMeters } from './haversine';

const REUSE_WITHIN_METERS = 75;
const CLIENT_ONLY_MESSAGE =
  'Current location is only available for client checkout';

export interface CurrentLocationResult {
  address: AddressResponse;
  reused: boolean;
}

@Injectable()
export class CurrentLocationAddressService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly googleDistanceService: GoogleDistanceService,
    private readonly addressesService: AddressesService
  ) {}

  async resolve(
    latitude: number,
    longitude: number
  ): Promise<CurrentLocationResult> {
    this.assertCoordinates(latitude, longitude);
    const nearby = await this.findWithin(latitude, longitude);
    if (nearby) return { address: nearby, reused: true };
    return this.createFromGps(latitude, longitude);
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
    const addresses = await this.loadClientAddresses();
    return (
      addresses.find((address) => this.isNearby(address, latitude, longitude)) ??
      null
    );
  }

  private async loadClientAddresses(): Promise<AddressResponse[]> {
    const user = await this.hasuraUserService.getUser();
    if (!user.client?.id) {
      throw new HttpException(
        {
          success: false,
          error: CLIENT_ONLY_MESSAGE,
          message: CLIENT_ONLY_MESSAGE,
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return this.hasuraSystemService.getAllUserAddresses(user.id, 'client');
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
    const created = await this.addressesService.createAddress(
      this.gpsPayload(geo, latitude, longitude),
      { persona: 'client' }
    );
    return { address: created.address, reused: false };
  }

  private gpsPayload(
    geo: GeocodingResult,
    latitude: number,
    longitude: number
  ) {
    return {
      address_line_1: this.line1(geo),
      city: geo.city || 'Unknown',
      state: geo.state || geo.city || geo.country_code || 'Unknown',
      postal_code: geo.postal_code || undefined,
      country: geo.country_code || geo.country,
      address_type: 'current_location',
      is_primary: false,
      latitude,
      longitude,
    };
  }

  private async reverse(latitude: number, longitude: number): Promise<GeocodingResult> {
    const geo = await this.lookup(latitude, longitude);
    if (geo.country_code || geo.country) return geo;
    throw new HttpException(
      { success: false, error: 'Could not resolve the current location' },
      HttpStatus.BAD_REQUEST
    );
  }

  private async lookup(latitude: number, longitude: number): Promise<GeocodingResult> {
    try {
      return await this.googleDistanceService.reverseGeocode(latitude, longitude);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: 'Could not resolve the current location' },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private line1(geo: GeocodingResult): string {
    return (
      geo.address_line_1?.trim() ||
      geo.formatted_address?.trim() ||
      'Current location'
    );
  }
}
