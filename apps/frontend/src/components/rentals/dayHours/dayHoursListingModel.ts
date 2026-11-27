import type { RentalTakenWindow } from '../../../hooks/useRentalApi';
import type { DayHoursListing, DayHoursWeeklyRow } from '../../../utils/rentalDayHoursPicker';
import { rentalBillableHours, type SelectionRange } from '../rentalRequestScheduleUtils';

function num(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Listing fields the picker reads. Missing switches (older API) read as both on. */
export function dayHoursListingModel(input: {
  weeklyAvailability: DayHoursWeeklyRow[];
  booked: RentalTakenWindow[];
  unitsAvailable: number;
  minRentalHours?: number | null;
  maxRentalHours?: number | null;
  basePricePerDay?: number | string | null;
  basePricePerHour?: number | string | null;
  offersDaily?: boolean | null;
  offersHourly?: boolean | null;
}): DayHoursListing {
  const offersDaily = input.offersDaily !== false;
  const offersHourly = input.offersHourly !== false || !offersDaily;
  return {
    weekly: input.weeklyAvailability ?? [],
    booked: input.booked,
    units: Math.max(1, Number(input.unitsAvailable) || 1),
    offersDaily,
    offersHourly,
    minHours: Math.max(1, Number(input.minRentalHours) || 1),
    maxHours: input.maxRentalHours == null ? null : Number(input.maxRentalHours),
    dayRate: num(input.basePricePerDay),
    hourRate: num(input.basePricePerHour),
  };
}

/** Min and max hours apply to each hourly block; full days are exempt. */
export function dayHoursBlockError(
  rows: SelectionRange[],
  minHours: number,
  maxHours: number | null
): 'min' | 'max' | null {
  for (const row of rows) {
    if (row.billing === 'all_day') continue;
    const hours = rentalBillableHours(row.startMs, row.endMs);
    if (hours < Math.max(1, minHours)) return 'min';
    if (maxHours != null && hours > maxHours) return 'max';
  }
  return null;
}
