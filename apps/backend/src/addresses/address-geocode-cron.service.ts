import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleDistanceService } from '../google/google-distance.service';
import type { ForwardGeocode } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type GeocodeStatus = 'success' | 'not_found' | 'country_mismatch';

interface AddressNeedingGeocode {
  id: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country: string;
}

const BATCH_LIMIT = 200;
const RETRY_AFTER_DAYS = 30;

const LIST_ADDRESSES_NEEDING_GEOCODE = `
  query AddressesNeedingGeocode($retryBefore: timestamptz!, $limit: Int!) {
    addresses(
      where: {
        latitude: { _is_null: true }
        address_line_1: { _is_null: false, _neq: "" }
        city: { _is_null: false, _neq: "" }
        country: { _is_null: false, _neq: "" }
        _or: [
          { geocode_attempted_at: { _is_null: true } }
          {
            _and: [
              { geocode_status: { _eq: "not_found" } }
              { geocode_attempted_at: { _lte: $retryBefore } }
            ]
          }
        ]
      }
      order_by: { created_at: asc }
      limit: $limit
    ) {
      id
      address_line_1
      address_line_2
      city
      state
      postal_code
      country
    }
  }
`;

const MARK_ADDRESS_GEOCODE = `
  mutation MarkAddressGeocode($id: uuid!, $set: addresses_set_input!) {
    update_addresses_by_pk(pk_columns: { id: $id }, _set: $set) {
      id
    }
  }
`;

export function countriesMatch(stored: string, hit: ForwardGeocode): boolean {
  const value = stored.trim().toLowerCase();
  if (!value) return false;
  const code = hit.countryCode.trim().toLowerCase();
  const name = hit.country.trim().toLowerCase();
  if (value.length === 2) return value === code;
  return value === name || value === code;
}

function formatAddressForGoogle(row: AddressNeedingGeocode): string {
  return [
    row.address_line_1,
    row.address_line_2,
    row.city,
    row.state,
    row.postal_code,
    row.country,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Fills missing address coordinates once a day.
 * Must not inject request-scoped providers.
 */
@Injectable()
export class AddressGeocodeCronService {
  private readonly logger = new Logger(AddressGeocodeCronService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly googleDistanceService: GoogleDistanceService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handlePendingAddressGeocodes(): Promise<void> {
    try {
      const n = await this.geocodePendingAddresses();
      if (n > 0) this.logger.log(`Geocoded ${n} address(es)`);
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    }
  }

  async geocodePendingAddresses(): Promise<number> {
    const rows = await this.loadPending();
    let updated = 0;
    for (const row of rows) {
      try {
        if (await this.geocodeOne(row)) updated += 1;
      } catch (error: any) {
        this.logger.error(
          `Geocode failed for address ${row.id}: ${error?.message ?? error}`
        );
      }
    }
    return updated;
  }

  private async loadPending(): Promise<AddressNeedingGeocode[]> {
    const retryBefore = new Date(
      Date.now() - RETRY_AFTER_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      addresses: AddressNeedingGeocode[];
    }>(LIST_ADDRESSES_NEEDING_GEOCODE, {
      retryBefore,
      limit: BATCH_LIMIT,
    });
    return res.addresses ?? [];
  }

  private async geocodeOne(row: AddressNeedingGeocode): Promise<boolean> {
    const hit = await this.googleDistanceService.geocodeWithCountry(
      formatAddressForGoogle(row)
    );
    if (!hit) {
      await this.mark(row.id, 'not_found');
      return false;
    }
    if (!countriesMatch(row.country, hit)) {
      await this.mark(row.id, 'country_mismatch');
      return false;
    }
    await this.mark(row.id, 'success', hit);
    return true;
  }

  private async mark(
    id: string,
    status: GeocodeStatus,
    hit?: ForwardGeocode
  ): Promise<void> {
    const set: Record<string, unknown> = {
      geocode_status: status,
      geocode_attempted_at: new Date().toISOString(),
    };
    if (status === 'success' && hit) {
      set.latitude = hit.latitude;
      set.longitude = hit.longitude;
    }
    await this.hasuraSystemService.executeMutation(MARK_ADDRESS_GEOCODE, {
      id,
      set,
    });
  }
}
