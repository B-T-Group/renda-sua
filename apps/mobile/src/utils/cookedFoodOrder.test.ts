import { describe, expect, it } from 'vitest';
import {
  isCookedFoodAwaitingClientPayment,
  isCookedFoodStartCookingPriority,
  shouldUseCookedFoodConfirmModal,
} from './cookedFoodOrder';

const asapPickup = {
  fulfillment_method: 'pickup' as const,
  fulfillment_timing: 'asap' as const,
};

describe('shouldUseCookedFoodConfirmModal', () => {
  it('uses the ready-in modal for ASAP pickup of cooked food', () => {
    expect(
      shouldUseCookedFoodConfirmModal({
        ...asapPickup,
        is_cooked_food_pickup: true,
        order_items: [{ is_cooked_food: false }],
      })
    ).toBe(true);
    expect(
      shouldUseCookedFoodConfirmModal({
        ...asapPickup,
        order_items: [{ is_cooked_food: true }],
      })
    ).toBe(true);
  });

  it('skips scheduled pickup, delivery, and mixed carts', () => {
    expect(
      shouldUseCookedFoodConfirmModal({
        fulfillment_method: 'pickup',
        delivery_time_windows: [{ id: 'slot' }],
        is_cooked_food_pickup: true,
      } as never)
    ).toBe(false);
    expect(
      shouldUseCookedFoodConfirmModal({
        fulfillment_method: 'delivery',
        fulfillment_timing: 'asap',
        is_cooked_food_pickup: true,
      })
    ).toBe(false);
    expect(
      shouldUseCookedFoodConfirmModal({
        ...asapPickup,
        order_items: [{ is_cooked_food: true }, { is_cooked_food: false }],
      })
    ).toBe(false);
  });
});

describe('cooked-food payment and cooking priority', () => {
  const confirmedPayAfter = {
    ...asapPickup,
    is_cooked_food_pickup: true,
    pay_after_merchant_confirm: true,
    current_status: 'confirmed',
  };

  it('waits on unpaid pay-after orders and starts after payment', () => {
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'pending',
      })
    ).toBe(true);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'authorized',
      })
    ).toBe(false);
    expect(
      isCookedFoodStartCookingPriority({
        ...confirmedPayAfter,
        payment_status: 'pending',
      })
    ).toBe(false);
    expect(
      isCookedFoodStartCookingPriority({
        ...confirmedPayAfter,
        payment_status: 'paid',
      })
    ).toBe(true);
    expect(
      isCookedFoodStartCookingPriority({
        ...asapPickup,
        is_cooked_food_pickup: true,
        current_status: 'preparing',
        payment_status: 'paid',
      })
    ).toBe(true);
    expect(
      isCookedFoodStartCookingPriority({
        ...asapPickup,
        is_cooked_food_pickup: true,
        current_status: 'pending',
        payment_status: 'paid',
      })
    ).toBe(false);
  });
});
