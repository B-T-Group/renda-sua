import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleDistanceService } from '../google/google-distance.service';
import type { ForwardGeocode } from '../google/google-distance.service';
import { DistributedLockService } from '../common/distributed-lock.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type GeocodeStatus = 'success' | 'not_found' | 'country_mismatch';

/** Why a row did not get coordinates (stored in addresses.geocode_reason, logged per night). */
export type GeocodeReason =
  | 'text_too_short'
  | 'text_not_street'
  | 'no_match'
  | 'country_mismatch'
  | 'partial_match'
  | 'low_precision'
  | 'no_street_component'
  | 'no_city_component';

const LOCK_KEY = 'cron:address-geocode';
const LOCK_TTL_MS = 30 * 60 * 1000;
const MIN_ADDRESS_LINE_CHARS = 5;
const ACCEPTED_PRECISION = new Set(['ROOFTOP', 'RANGE_INTERPOLATED']);

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
        status: { _eq: active }
        address_line_1: { _is_null: false, _neq: "" }
        city: { _is_null: false, _neq: "" }
        country: { _is_null: false, _neq: "" }
        client_addresses: {}
        _not: {
          _or: [
            { business_addresses: {} }
            { agent_addresses: {} }
            { business_locations: {} }
            { orders: {} }
          ]
        }
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

/** Pre-flight text check: no Google call for rows that cannot be a real street address. */
export function addressTextProblem(row: AddressNeedingGeocode): GeocodeReason | null {
  const line = (row.address_line_1 ?? '').trim();
  if (line.length < MIN_ADDRESS_LINE_CHARS) return 'text_too_short';
  const letters = (line.match(/\p{L}/gu) ?? []).length;
  if (letters < 3 || (row.city ?? '').trim().length < 2) return 'text_not_street';
  return null;
}

/** Decide whether a Google hit is trustworthy enough to store as coordinates. */
export function hitRejection(
  row: AddressNeedingGeocode,
  hit: ForwardGeocode
): { status: GeocodeStatus; reason: GeocodeReason } | null {
  if (!countriesMatch(row.country, hit)) {
    return { status: 'country_mismatch', reason: 'country_mismatch' };
  }
  if (hit.partialMatch) return { status: 'not_found', reason: 'partial_match' };
  if (!ACCEPTED_PRECISION.has(hit.locationType)) {
    return { status: 'not_found', reason: 'low_precision' };
  }
  if (!hit.hasStreet) return { status: 'not_found', reason: 'no_street_component' };
  if (!hit.hasCity) return { status: 'not_found', reason: 'no_city_component' };
  return null;
}

/**
 * Fills missing address coordinates once a day.
 * Only active, client-linked addresses that no order references, and only with a
 * street-level, non-partial Google match. Single-runner via a shared Redis lock.
 * Must not inject request-scoped providers.
 */
@Injectable()
export class AddressGeocodeCronService {
  private readonly logger = new Logger(AddressGeocodeCronService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly googleDistanceService: GoogleDistanceService,
    private readonly locks: DistributedLockService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handlePendingAddressGeocodes(): Promise<void> {
    const release = await this.locks.tryAcquire(LOCK_KEY, LOCK_TTL_MS, {
      requireShared: true,
    });
    if (!release) {
      this.logger.warn('address geocode: another instance holds the lock, skipping');
      return;
    }
    try {
      const n = await this.geocodePendingAddresses();
      if (n > 0) this.logger.log(`Geocoded ${n} address(es)`);
    } catch (error: any) {
      this.logger.error(error?.message ?? String(error));
    } finally {
      await release();
    }
  }

  async geocodePendingAddresses(): Promise<number> {
    const rows = await this.loadPending();
    const outcomes: Record<string, number> = {};
    let updated = 0;
    for (const row of rows) {
      try {
        const outcome = await this.geocodeOne(row);
        outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
        if (outcome === 'success') updated += 1;
      } catch (error: any) {
        outcomes.error = (outcomes.error ?? 0) + 1;
        this.logger.error(
          `Geocode failed for address ${row.id}: ${error?.message ?? error}`
        );
      }
    }
    if (rows.length > 0) {
      this.logger.log(`address geocode outcomes: ${JSON.stringify(outcomes)}`);
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

  /** Returns the outcome label (`success` or the rejection reason). */
  private async geocodeOne(row: AddressNeedingGeocode): Promise<string> {
    const problem = addressTextProblem(row);
    if (problem) {
      await this.mark(row.id, 'not_found', problem);
      return problem;
    }
    const hit = await this.googleDistanceService.geocodeWithCountry(
      formatAddressForGoogle(row)
    );
    if (!hit) {
      await this.mark(row.id, 'not_found', 'no_match');
      return 'no_match';
    }
    const rejection = hitRejection(row, hit);
    if (rejection) {
      await this.mark(row.id, rejection.status, rejection.reason);
      return rejection.reason;
    }
    await this.mark(row.id, 'success', null, hit);
    return 'success';
  }

  private async mark(
    id: string,
    status: GeocodeStatus,
    reason: GeocodeReason | null,
    hit?: ForwardGeocode
  ): Promise<void> {
    const set: Record<string, unknown> = {
      geocode_status: status,
      geocode_reason: reason,
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
