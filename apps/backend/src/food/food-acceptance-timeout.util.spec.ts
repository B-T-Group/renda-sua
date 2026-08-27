import {
  capAcceptanceTimeoutForFood,
  FOOD_ORDER_CONFIRMATION_TIMEOUT_SECONDS,
} from './food-acceptance-timeout.util';

describe('capAcceptanceTimeoutForFood', () => {
  it('leaves non-food orders on the merchant window', () => {
    const actual = capAcceptanceTimeoutForFood({
      timeoutSeconds: 3600,
      containsCookedFood: false,
    });

    expect(actual).toBe(3600);
  });

  it('caps a long merchant window for cooked food', () => {
    const actual = capAcceptanceTimeoutForFood({
      timeoutSeconds: 3600,
      containsCookedFood: true,
    });

    expect(actual).toBe(FOOD_ORDER_CONFIRMATION_TIMEOUT_SECONDS);
  });

  it('keeps a shorter merchant window for cooked food', () => {
    const actual = capAcceptanceTimeoutForFood({
      timeoutSeconds: 900,
      containsCookedFood: true,
    });

    expect(actual).toBe(900);
  });

  it('caps at thirty minutes', () => {
    expect(FOOD_ORDER_CONFIRMATION_TIMEOUT_SECONDS).toBe(1800);
  });
});
