import { timezoneFromAddressCountryCode } from '../users/user-timezone.util';
import {
  FoodAvailabilitySlot,
  resolveFoodAvailability,
} from './food-availability.util';
import { FOOD_CATEGORY_NAME } from './food.constants';

export interface FoodSettingsRow {
  marked_unavailable_at?: string | null;
  availability_slots?: FoodAvailabilitySlot[] | null;
}

export interface FoodAvailabilityRow {
  item?: {
    preparation_minutes?: number | null;
    item_sub_category?: {
      item_category?: { name?: string | null } | null;
    } | null;
  } | null;
  food_settings?: FoodSettingsRow[] | null;
  business_location?: {
    address?: { country?: string | null } | null;
  } | null;
}

export interface FoodAvailabilityPayload {
  has_schedule: boolean;
  is_open_now: boolean;
  is_marked_unavailable_today: boolean;
  is_available_now: boolean;
  next_opening_at: string | null;
  timezone: string;
  slots: FoodAvailabilitySlot[];
}

export function isFoodCategoryName(name?: string | null): boolean {
  return (name ?? '').trim() === FOOD_CATEGORY_NAME;
}

export function isFoodRow(row: FoodAvailabilityRow): boolean {
  return isFoodCategoryName(row?.item?.item_sub_category?.item_category?.name);
}

export function resolveRowTimezone(row: FoodAvailabilityRow): string {
  return timezoneFromAddressCountryCode(
    row?.business_location?.address?.country ?? ''
  );
}

function sortSlots(slots: FoodAvailabilitySlot[]): FoodAvailabilitySlot[] {
  return [...slots].sort(
    (a, b) =>
      a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
  );
}

/**
 * Availability for one storefront row. Returns null for non-food items so the
 * payload only carries the extra block where it means something.
 */
export function buildFoodAvailabilityPayload(
  row: FoodAvailabilityRow,
  now: Date
): FoodAvailabilityPayload | null {
  if (!isFoodRow(row)) return null;
  const settings = row.food_settings?.[0];
  const slots = sortSlots(settings?.availability_slots ?? []);
  const timezone = resolveRowTimezone(row);
  const availability = resolveFoodAvailability({
    slots,
    markedUnavailableAt: settings?.marked_unavailable_at ?? null,
    now,
    timezone,
  });
  return {
    has_schedule: availability.hasSchedule,
    is_open_now: availability.isOpenNow,
    is_marked_unavailable_today: availability.isMarkedUnavailableToday,
    is_available_now: availability.isAvailableNow,
    next_opening_at: availability.nextOpeningAt?.toISOString() ?? null,
    timezone,
    slots,
  };
}
