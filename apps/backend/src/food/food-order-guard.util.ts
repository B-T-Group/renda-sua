import { DateTime } from 'luxon';
import {
  buildFoodAvailabilityPayload,
  type FoodAvailabilityRow,
} from './food-item-availability.mapper';

export const FOOD_ITEM_CLOSED_CODE = 'FOOD_ITEM_CLOSED';
export const FOOD_ITEM_SOLD_OUT_CODE = 'FOOD_ITEM_SOLD_OUT';

export interface FoodOrderBlock {
  code: typeof FOOD_ITEM_CLOSED_CODE | typeof FOOD_ITEM_SOLD_OUT_CODE;
  message: string;
}

function describeNextOpening(
  nextOpeningAt: string | null,
  timezone: string
): string {
  if (!nextOpeningAt) return '';
  const local = DateTime.fromISO(nextOpeningAt, { zone: timezone });
  if (!local.isValid) return '';
  return ` It opens ${local.toFormat('cccc')} at ${local.toFormat('HH:mm')}.`;
}

/**
 * Cooked food can only be ordered while a serving window is open and the
 * kitchen has not marked the dish sold out for the day. Returns null for
 * anything that is orderable, including every non-food item.
 */
export function checkFoodOrderable(
  row: FoodAvailabilityRow & { item?: { name?: string | null } | null },
  now: Date = new Date()
): FoodOrderBlock | null {
  const availability = buildFoodAvailabilityPayload(row, now);
  if (!availability || availability.is_available_now) return null;

  const name = row?.item?.name ?? 'An item';
  if (availability.is_marked_unavailable_today) {
    return {
      code: FOOD_ITEM_SOLD_OUT_CODE,
      message: `${name} is sold out for today.`,
    };
  }
  return {
    code: FOOD_ITEM_CLOSED_CODE,
    message: `${name} is not being served right now.${describeNextOpening(
      availability.next_opening_at,
      availability.timezone
    )}`,
  };
}
