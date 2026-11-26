/**
 * Prices and switches for the web create-listing screens (first rental onboarding and the
 * catalog "Add location listing" dialog). Same rules as the edit page and mobile add-rental:
 * - flag off: hourly price required, an empty day price means 12 × hourly, no switches sent;
 * - flag on (rentals_day_hours_picker_enabled): at least one switch on, each switched-on mode
 *   needs a price above 0, a switched-off mode is sent as 0, and offers_daily / offers_hourly are sent.
 */
export interface CreateListingModes {
  offersDaily: boolean;
  offersHourly: boolean;
}

export type CreateListingPrices =
  | {
      ok: true;
      base_price_per_hour: number;
      base_price_per_day: number;
      offers_daily?: boolean;
      offers_hourly?: boolean;
    }
  | { ok: false; reason: 'modes' | 'hourly' | 'daily' };

function parsePrice(raw: string): number {
  const trimmed = raw.trim();
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

export function createListingPrices(input: {
  hourlyRaw: string;
  dailyRaw: string;
  modesOn: boolean;
  modes: CreateListingModes;
}): CreateListingPrices {
  const hourly = parsePrice(input.hourlyRaw);
  const dailyTyped = parsePrice(input.dailyRaw);
  if (!input.modesOn) {
    if (!Number.isFinite(hourly) || hourly < 0) return { ok: false, reason: 'hourly' };
    const daily = input.dailyRaw.trim() === '' ? Number((hourly * 12).toFixed(2)) : dailyTyped;
    if (!Number.isFinite(daily) || daily < 0) return { ok: false, reason: 'daily' };
    return { ok: true, base_price_per_hour: hourly, base_price_per_day: daily };
  }
  const { offersDaily, offersHourly } = input.modes;
  if (!offersDaily && !offersHourly) return { ok: false, reason: 'modes' };
  if (offersHourly && !(Number.isFinite(hourly) && hourly > 0)) return { ok: false, reason: 'hourly' };
  if (offersDaily && !(Number.isFinite(dailyTyped) && dailyTyped > 0)) return { ok: false, reason: 'daily' };
  return {
    ok: true,
    base_price_per_hour: offersHourly ? hourly : 0,
    base_price_per_day: offersDaily ? dailyTyped : 0,
    offers_daily: offersDaily,
    offers_hourly: offersHourly,
  };
}
