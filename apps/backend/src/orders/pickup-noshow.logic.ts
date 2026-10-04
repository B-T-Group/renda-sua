import { HttpException, HttpStatus } from '@nestjs/common';
import {
  normalizeFeeCountryCode,
  type FeeConfigRunner,
  type FeeLogger,
} from './fee-percent.util';

export const PICKUP_NOSHOW_CANCEL_HOURS_KEY = 'pickup_noshow_cancel_hours';
export const DEFAULT_PICKUP_NOSHOW_HOURS = 2;
export const PICKUP_REMINDER_COOLDOWN_MS = 30 * 60 * 1000;
export const CLIENT_NO_SHOW_REASON = 'client_no_show';

export interface PickupNoshowClock {
  hours: number;
  readyAt: string | null;
  opensAt: string | null;
  canCancel: boolean;
}

interface ClockOrder {
  id: string;
  business_location?: { address?: { country?: string | null } | null; country_code?: string | null } | null;
}

export async function loadPickupNoshowClock(
  hasura: FeeConfigRunner,
  order: ClockOrder,
  logger: FeeLogger
): Promise<PickupNoshowClock> {
  const hours = await resolveNoshowHours(hasura, order, logger);
  const readyAt = await loadReadyAt(hasura, order.id);
  return clockFrom(readyAt, hours, Date.now());
}

export function assertNoshowWindowOpen(clock: PickupNoshowClock): void {
  if (clock.canCancel) return;
  const when = clock.opensAt ? ` after ${clock.opensAt}` : '';
  throw new HttpException(
    `This pickup can be cancelled for a no-show only after it has been ready for ${clock.hours} hours${when}`,
    HttpStatus.BAD_REQUEST
  );
}

export function reminderCoolingDown(lastSentAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastSentAt) return false;
  const sent = Date.parse(lastSentAt);
  return Number.isFinite(sent) && now - sent < PICKUP_REMINDER_COOLDOWN_MS;
}

function clockFrom(readyAt: Date | null, hours: number, now: number): PickupNoshowClock {
  if (!readyAt) {
    return { hours, readyAt: null, opensAt: null, canCancel: false };
  }
  const opens = new Date(readyAt.getTime() + hours * 60 * 60 * 1000);
  return {
    hours,
    readyAt: readyAt.toISOString(),
    opensAt: opens.toISOString(),
    canCancel: now >= opens.getTime(),
  };
}

async function resolveNoshowHours(
  hasura: FeeConfigRunner,
  order: ClockOrder,
  logger: FeeLogger
): Promise<number> {
  const country = normalizeFeeCountryCode(
    order.business_location?.country_code ?? order.business_location?.address?.country
  );
  const rows = await loadHourRows(hasura, country);
  const match = pickHourRow(rows, country);
  if (!match) {
    logger.warn(
      `pickup_noshow_hours_missing order=${order.id} country=${country ?? 'unknown'}; using ${DEFAULT_PICKUP_NOSHOW_HOURS}`
    );
    return DEFAULT_PICKUP_NOSHOW_HOURS;
  }
  return validHours(match.number_value);
}

function pickHourRow(
  rows: Array<{ country_code?: string | null; number_value?: number | string | null }>,
  country: string | null
) {
  const countryRow = country
    ? rows.find((row) => String(row.country_code ?? '').toUpperCase() === country)
    : undefined;
  return countryRow ?? rows.find((row) => !row.country_code);
}

function validHours(value: number | string | null | undefined): number {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 168) {
    throw new HttpException(
      'pickup_noshow_cancel_hours must be between 0 and 168',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
  return hours;
}

async function loadHourRows(hasura: FeeConfigRunner, country: string | null) {
  const data = await hasura.executeQuery(
    `
    query PickupNoshowHours($key: String!, $country: String) {
      application_configurations(
        where: {
          config_key: { _eq: $key }
          status: { _eq: "active" }
          _or: [
            { country_code: { _eq: $country } }
            { country_code: { _is_null: true } }
          ]
        }
      ) { country_code number_value }
    }
    `,
    { key: PICKUP_NOSHOW_CANCEL_HOURS_KEY, country }
  );
  return data?.application_configurations ?? [];
}

async function loadReadyAt(hasura: FeeConfigRunner, orderId: string): Promise<Date | null> {
  const data = await hasura.executeQuery(
    `
    query PickupReadyAt($orderId: uuid!) {
      order_status_history(
        where: { order_id: { _eq: $orderId }, status: { _eq: ready_for_pickup } }
        order_by: { created_at: asc }
        limit: 1
      ) { created_at }
    }
    `,
    { orderId }
  );
  const created = data?.order_status_history?.[0]?.created_at;
  if (!created) return null;
  const readyAt = new Date(created);
  return Number.isNaN(readyAt.getTime()) ? null : readyAt;
}
