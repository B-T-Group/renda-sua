import { FOOD_ORDER_CONFIRMATION_TIMEOUT_MINUTES } from './food.constants';

const SECONDS_PER_MINUTE = 60;

export const FOOD_ORDER_CONFIRMATION_TIMEOUT_SECONDS =
  FOOD_ORDER_CONFIRMATION_TIMEOUT_MINUTES * SECONDS_PER_MINUTE;

/**
 * Merchants can widen their accept window up to an hour, which is too long for
 * hot food, so orders containing cooked food fall back to the platform food
 * timeout. A shorter merchant window is left alone.
 */
export function capAcceptanceTimeoutForFood(params: {
  timeoutSeconds: number;
  containsCookedFood: boolean;
}): number {
  if (!params.containsCookedFood) return params.timeoutSeconds;
  return Math.min(
    params.timeoutSeconds,
    FOOD_ORDER_CONFIRMATION_TIMEOUT_SECONDS
  );
}
