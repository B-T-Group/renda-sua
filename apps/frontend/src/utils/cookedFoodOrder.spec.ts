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
        order_items: [{ item: { is_cooked_food: true } }],
      })
    ).toBe(true);
  });

  it('skips scheduled pickup, delivery, and mixed carts', () => {
    expect(
      shouldUseCookedFoodConfirmModal({
        fulfillment_method: 'pickup',
        delivery_time_windows: [{ id: 'slot' }],
        is_cooked_food_pickup: true,
      })
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
    expect(shouldUseCookedFoodConfirmModal({ ...asapPickup, order_items: [] })).toBe(
      false
    );
  });

  it('treats a pickup with no window as ASAP', () => {
    expect(
      shouldUseCookedFoodConfirmModal({
        fulfillment_method: 'pickup',
        is_cooked_food_pickup: true,
        delivery_time_windows: [],
      })
    ).toBe(true);
  });
});

describe('cooked-food payment and cooking priority', () => {
  const confirmedPayAfter = {
    ...asapPickup,
    is_cooked_food_pickup: true,
    pay_after_merchant_confirm: true,
    current_status: 'confirmed',
  };

  it('waits on any unpaid pay-after status except paid and authorized', () => {
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'pending',
      })
    ).toBe(true);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'failed',
      })
    ).toBe(true);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'paid',
      })
    ).toBe(false);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        payment_status: 'authorized',
      })
    ).toBe(false);
    expect(
      isCookedFoodAwaitingClientPayment({
        ...confirmedPayAfter,
        pay_after_merchant_confirm: false,
        payment_status: 'pending',
      })
    ).toBe(false);
  });

  it('starts cooking after payment, and while already preparing', () => {
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
        current_status: 'confirmed',
        payment_status: 'authorized',
      })
    ).toBe(true);
    expect(
      isCookedFoodStartCookingPriority({
        ...asapPickup,
        is_cooked_food_pickup: true,
        current_status: 'preparing',
        pay_after_merchant_confirm: true,
        payment_status: 'pending',
      })
    ).toBe(true);
    expect(
      isCookedFoodStartCookingPriority({
        ...asapPickup,
        is_cooked_food_pickup: true,
        current_status: 'ready_for_pickup',
        payment_status: 'paid',
      })
    ).toBe(false);
  });
});
